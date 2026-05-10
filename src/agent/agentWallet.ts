import * as https from "https";
import * as crypto from "crypto";
import * as fs from "fs";

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
  const publicKey = fs.readFileSync("publickey.txt", "utf8").trim();
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
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Failed to parse Circle API response")); }
      });
    });
    req.on("error", reject);
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
    const tokens = response.data?.tokenBalances || [];
    const usdc   = tokens.find((t: any) =>
      t.token?.symbol === "USDC" || t.token?.name?.includes("USD")
    );
    return parseFloat(usdc?.amount || "0");
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
      return {
        success: false,
        error:   `Insufficient agent balance. Has ${balance} USDC, needs ${QUERY_PRICE} USDC`,
      };
    }

    const body = {
      idempotencyKey:         crypto.randomUUID(),
      entitySecretCiphertext: generateCiphertext(),
      amounts:                [QUERY_PRICE.toFixed(2)],
      destinationAddress:     SERVICE_WALLET_ADDRESS, // ← service wallet receives
      walletId:               AGENT_WALLET_ID,         // ← agent wallet sends
      blockchain:             "ARC-TESTNET",
      tokenAddress:           "",
      refId:                  queryId,
    };

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

    console.error("Circle payment rejected:", JSON.stringify(response, null, 2));
    return {
       success: false,
       error:   response.message || JSON.stringify(response),
   };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Verify payment confirmed on chain ─────────────────────────
export async function verifyAgentPayment(
  txId: string,
  maxRetries = 5,
  delayMs    = 3000
): Promise<{ confirmed: boolean; amount?: number }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await circleRequest(
        "GET",
        `/v1/w3s/developer/transactions/${txId}`
      );

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