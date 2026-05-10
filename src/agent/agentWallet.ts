import * as https from "https";
import * as crypto from "crypto";

// ── Config ────────────────────────────────────────────────────
const API_KEY              = process.env.CIRCLE_API_KEY!;
const ENTITY_SECRET        = process.env.CIRCLE_ENTITY_SECRET!;

// Agent wallet — sends USDC payments
const AGENT_WALLET_ID      = process.env.CIRCLE_AGENT_WALLET_ID!;
const AGENT_WALLET_ADDRESS = process.env.CIRCLE_AGENT_WALLET_ADDRESS!;

// Service wallet — receives USDC payments
const SERVICE_WALLET_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS!;
const SERVICE_WALLET_ID      = process.env.CIRCLE_WALLET_ID!;

const QUERY_PRICE = 0.1; // USDC

// ── Generate fresh ciphertext every call ─────────────────────
function generateCiphertext(): string {
  const publicKey = process.env.CIRCLE_ENTITY_PUBLIC_KEY!.replace(/\\n/g, "\n");
  const encrypted = crypto.publicEncrypt(
    {
      key:      publicKey,
      padding:  crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(ENTITY_SECRET, "hex")
  );
  return encrypted.toString("base64");
}

// ── HTTP helper ───────────────────────────────────────────────
function circleRequest(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : "";
    const options = {
      hostname: "api.circle.com",
      path,
      method,
      headers: {
        Authorization:    `Bearer ${API_KEY}`,
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.code && parsed.code !== 0) {
            console.error("🔴 Circle API error response:");
            console.error(JSON.stringify(parsed, null, 2));
          }
          resolve(parsed);
        } catch {
          console.error("🔴 Raw Circle response (unparseable):", data);
          reject(new Error("Failed to parse Circle API response"));
        }
      });
    });
    req.on("error", (err) => {
      console.error("🔴 Circle HTTP request error:", err.message);
      reject(err);
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Get agent wallet USDC balance ─────────────────────────────
export async function getAgentBalance(): Promise<number> {
  try {
    const response = await circleRequest(
      "GET",
      `/v1/w3s/wallets/${AGENT_WALLET_ID}/balances`
    );
    const tokens  = response.data?.tokenBalances || [];
    const usdc    = tokens.find((t: any) =>
      t.token?.symbol === "USDC" || t.token?.name?.includes("USD")
    );
    const balance = parseFloat(usdc?.amount || "0");
    console.log(`💰 Agent wallet balance: ${balance} USDC`);
    return balance;
  } catch (err: any) {
    console.error("Failed to get agent balance:", err.message);
    return 0;
  }
}

// ── Get service wallet USDC balance ──────────────────────────
export async function getServiceBalance(): Promise<number> {
  try {
    const response = await circleRequest(
      "GET",
      `/v1/w3s/wallets/${SERVICE_WALLET_ID}/balances`
    );
    const tokens = response.data?.tokenBalances || [];
    const usdc   = tokens.find((t: any) =>
      t.token?.symbol === "USDC" || t.token?.name?.includes("USD")
    );
    return parseFloat(usdc?.amount || "0");
  } catch (err: any) {
    console.error("Failed to get service balance:", err.message);
    return 0;
  }
}

// ── Agent pays service wallet for intelligence ────────────────
export async function payForIntelligence(
  queryId: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    const balance = await getAgentBalance();

    if (balance < QUERY_PRICE) {
      console.error(`❌ Insufficient agent balance: ${balance} USDC (needs ${QUERY_PRICE})`);
      return {
        success: false,
        error:   `Insufficient agent balance. Has ${balance} USDC, needs ${QUERY_PRICE} USDC`,
      };
    }

    const ciphertext = generateCiphertext();
    console.log(`🔐 Ciphertext generated (length: ${ciphertext.length})`);

    const body = {
      idempotencyKey:         crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      amounts:                [QUERY_PRICE.toFixed(2)],
      destinationAddress:     SERVICE_WALLET_ADDRESS,
      walletId:               AGENT_WALLET_ID,
      blockchain:             "ARC-TESTNET",
      feeLevel:               "MEDIUM",
      refId:                  queryId,
    };

    console.log(`📤 Sending payment request:`);
    console.log(`   walletId (sender):   ${AGENT_WALLET_ID}`);
    console.log(`   destination:         ${SERVICE_WALLET_ADDRESS}`);
    console.log(`   amount:              ${QUERY_PRICE} USDC`);
    console.log(`   blockchain:          ARC-TESTNET`);
    console.log(`   feeLevel:            MEDIUM`);

    const response = await circleRequest(
      "POST",
      "/v1/w3s/developer/transactions/transfer",
      body
    );

    if (response.data?.id) {
      console.log(`💸 Agent→Service payment sent: ${response.data.id}`);
      console.log(`   From: ${AGENT_WALLET_ADDRESS}`);
      console.log(`   To:   ${SERVICE_WALLET_ADDRESS}`);
      console.log(`   Amount: ${QUERY_PRICE} USDC`);
      return { success: true, txId: response.data.id };
    }

    console.error("❌ Circle payment rejected — full response:");
    console.error(JSON.stringify(response, null, 2));
    return {
      success: false,
      error:   response.message || JSON.stringify(response),
    };

  } catch (err: any) {
    console.error("💥 payForIntelligence exception:", err.message);
    return { success: false, error: err.message };
  }
}

// ── Fetch on-chain tx hash from Circle after indexing ─────────
export async function getOnChainTxHash(txId: string): Promise<string | null> {
  try {
    // Wait for Circle to index the transaction
    console.log(`⏳ Waiting 15s for Circle to index transaction...`);
    await new Promise(r => setTimeout(r, 15000));

    const response = await circleRequest(
      "GET",
      `/v1/w3s/developer/transactions/${txId}`
    );

    const txHash = response.data?.transaction?.txHash || null;

    if (txHash) {
      console.log(`🔗 On-chain hash: ${txHash}`);
    } else {
      console.log(`⚠️  On-chain hash not yet available for ${txId}`);
    }

    return txHash;
  } catch (err: any) {
    console.error("Failed to fetch on-chain tx hash:", err.message);
    return null;
  }
}

// ── Verify payment confirmed on chain ─────────────────────────
export async function verifyAgentPayment(
  txId: string,
  maxRetries = 10,
  delayMs    = 6000
): Promise<{ confirmed: boolean; amount?: number }> {

  // Wait before first check — tx needs time to propagate to Circle API
  console.log(`⏳ Waiting 10s before first verification check...`);
  await new Promise((r) => setTimeout(r, 10000));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await circleRequest(
        "GET",
        `/v1/w3s/developer/transactions/${txId}`
      );

      // Transaction not yet visible — treat as still pending
      if (response.code === -1 || response.message === "Resource not found") {
        console.log(`⏳ Transaction not yet visible on Circle API (attempt ${attempt}/${maxRetries})`);
        if (attempt < maxRetries) await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      const tx        = response.data?.transaction;
      const state     = tx?.state;
      const amount    = parseFloat(tx?.amounts?.[0] || "0");
      const confirmed = state === "CONFIRMED" || state === "COMPLETE";

      if (confirmed && amount >= QUERY_PRICE) {
        console.log(`✅ Payment confirmed: ${amount} USDC (attempt ${attempt})`);
        return { confirmed: true, amount };
      }

      if (state === "FAILED" || state === "CANCELLED") {
        console.log(`❌ Payment ${state}: tx ${txId}`);
        return { confirmed: false };
      }

      console.log(`⏳ Payment state: ${state || "PENDING"} (attempt ${attempt}/${maxRetries})`);

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (err: any) {
      console.error(`Payment check error (attempt ${attempt}):`, err.message);
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { confirmed: false };
}

export {
  QUERY_PRICE,
  AGENT_WALLET_ID,
  AGENT_WALLET_ADDRESS,
  SERVICE_WALLET_ADDRESS,
  SERVICE_WALLET_ID,
};