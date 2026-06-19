import * as https from "https";
import * as crypto from "crypto";

// ── Config ────────────────────────────────────────────────────
const API_KEY              = process.env.CIRCLE_API_KEY!;
const ENTITY_SECRET        = process.env.CIRCLE_ENTITY_SECRET!;

// Agent wallet — sends USDC payments
const AGENT_WALLET_ID      = process.env.CIRCLE_AGENT_WALLET_ID!;
const AGENT_WALLET_ADDRESS = process.env.CIRCLE_AGENT_WALLET_ADDRESS!;

// Service wallet — receives legacy USDC payments
const SERVICE_WALLET_ADDRESS = process.env.CIRCLE_WALLET_ADDRESS!;
const SERVICE_WALLET_ID      = process.env.CIRCLE_WALLET_ID!;

// ArcSenseGate contract on Arc Testnet
const ARCSENSE_GATE_ADDRESS = "0xd0aEAD5b90eD18bBe830cDA38789B60F4abbab4D";

const QUERY_PRICE = 0.1; // USDC

// ── QueryType enum — mirrors ArcSenseGate.sol ─────────────────
export enum QueryType {
  NETWORK       = 0,
  CONTRACT_RISK = 1,
  BLOCK         = 2,
  USAGE         = 3,
  WEEKLY        = 4,
}

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

// ── HTTP helper for Circle API ────────────────────────────────
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

// ── HTTP GET helper for Blockscout API ────────────────────────
function blockscoutGet(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "testnet.arcscan.app",
      path,
      method:   "GET",
      headers:  { "Accept": "application/json" },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Failed to parse Blockscout response")); }
      });
    });
    req.on("error", reject);
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

// ── Call ArcSenseGate.purchaseNative(queryType) ───────────────
// Sends 0.1 USDC native value to the contract + records the query type.
// This is the primary payment path — replaces direct wallet-to-wallet transfer.
// The contract emits QueryPurchased which the engine listens to.
export async function callContractPurchase(
  queryId:   string,
  queryType: QueryType = QueryType.NETWORK
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

    // Call purchaseNative(uint8 queryType) with 0.1 USDC native value
    const body = {
      idempotencyKey:         crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      walletId:               AGENT_WALLET_ID,
      blockchain:             "ARC-TESTNET",
      contractAddress:        ARCSENSE_GATE_ADDRESS,
      abiFunctionSignature:   "purchaseNative(uint8)",
      abiParameters:          [queryType.toString()],
      amount:                 QUERY_PRICE.toFixed(2), // 0.1 USDC native
      feeLevel:               "MEDIUM",
      refId:                  queryId,
    };

    console.log(`📤 Calling ArcSenseGate.purchaseNative(${QueryType[queryType]}):`);
    console.log(`   Contract:  ${ARCSENSE_GATE_ADDRESS}`);
    console.log(`   Agent:     ${AGENT_WALLET_ID}`);
    console.log(`   Amount:    ${QUERY_PRICE} USDC`);
    console.log(`   QueryType: ${queryType} (${QueryType[queryType]})`);

    const response = await circleRequest(
      "POST",
      "/v1/w3s/developer/transactions/contractExecution",
      body
    );

    if (response.data?.id) {
      console.log(`✅ Contract call submitted: ${response.data.id}`);
      console.log(`   ArcSenseGate: ${ARCSENSE_GATE_ADDRESS}`);
      return { success: true, txId: response.data.id };
    }

    // Fallback to direct transfer if contract execution not supported
    console.warn("⚠️  Contract execution failed, falling back to direct transfer");
    console.error(JSON.stringify(response, null, 2));
    return await payForIntelligence(queryId);

  } catch (err: any) {
    console.error("💥 callContractPurchase exception:", err.message);
    // Fallback to legacy transfer
    console.warn("⚠️  Falling back to direct USDC transfer");
    return await payForIntelligence(queryId);
  }
}

// ── Agent pays service wallet directly (legacy fallback) ──────
// Kept as fallback in case contract execution is unavailable.
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

    console.log(`📤 Sending direct transfer (legacy):`);
    console.log(`   From: ${AGENT_WALLET_ADDRESS}`);
    console.log(`   To:   ${SERVICE_WALLET_ADDRESS}`);
    console.log(`   Amount: ${QUERY_PRICE} USDC`);

    const response = await circleRequest(
      "POST",
      "/v1/w3s/developer/transactions/transfer",
      body
    );

    if (response.data?.id) {
      console.log(`💸 Direct transfer sent: ${response.data.id}`);
      return { success: true, txId: response.data.id };
    }

    console.error("❌ Direct transfer rejected:");
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

// ── Fetch on-chain tx hash via Blockscout API ─────────────────
export async function getOnChainTxHash(
  walletAddress: string
): Promise<string | null> {
  try {
    console.log(`⏳ Waiting 8s for tx to land on Arc Testnet...`);
    await new Promise(r => setTimeout(r, 8000));

    console.log(`🔍 Fetching latest tx from Blockscout for ${walletAddress}`);
    const response = await blockscoutGet(
      `/api/v2/addresses/${walletAddress}/transactions?filter=from`
    );

    const latestTx = response?.items?.[0];
    const txHash   = latestTx?.hash || null;

    if (txHash) {
      console.log(`🔗 On-chain tx hash: ${txHash}`);
      console.log(`   Arc Explorer: https://testnet.arcscan.app/tx/${txHash}`);
    } else {
      console.log(`⚠️  No recent tx found for ${walletAddress} on Blockscout`);
    }

    return txHash;
  } catch (err: any) {
    console.error("Failed to fetch on-chain tx hash:", err.message);
    return null;
  }
}

// ── Verify payment from ANY wallet via Blockscout ─────────────
export async function verifyExternalPayment(
  fromWalletAddress: string,
  minAmount: number = QUERY_PRICE
): Promise<{ confirmed: boolean; txHash?: string }> {
  try {
    console.log(`🔍 Verifying external payment from ${fromWalletAddress}`);
    await new Promise(r => setTimeout(r, 5000));

    const response = await blockscoutGet(
      `/api/v2/addresses/${SERVICE_WALLET_ADDRESS}/transactions?filter=to`
    );

    const items = response?.items || [];

    const match = items.find((tx: any) => {
      const from   = (tx.from?.hash || "").toLowerCase();
      const target = fromWalletAddress.toLowerCase();
      const value  = parseFloat(tx.value || "0") / 1e18;
      return from === target && value >= minAmount;
    });

    if (match) {
      console.log(`✅ External payment verified: ${match.hash}`);
      return { confirmed: true, txHash: match.hash };
    }

    // Also check payments to the contract (new path)
    const contractResponse = await blockscoutGet(
      `/api/v2/addresses/${ARCSENSE_GATE_ADDRESS}/transactions?filter=to`
    );

    const contractItems = contractResponse?.items || [];
    const contractMatch = contractItems.find((tx: any) => {
      const from  = (tx.from?.hash || "").toLowerCase();
      const target = fromWalletAddress.toLowerCase();
      const value  = parseFloat(tx.value || "0") / 1e18;
      return from === target && value >= minAmount;
    });

    if (contractMatch) {
      console.log(`✅ Contract payment verified: ${contractMatch.hash}`);
      return { confirmed: true, txHash: contractMatch.hash };
    }

    console.log(`⚠️  No matching payment found from ${fromWalletAddress}`);
    return { confirmed: false };
  } catch (err: any) {
    console.error("Failed to verify external payment:", err.message);
    return { confirmed: false };
  }
}

export {
  QUERY_PRICE,
  AGENT_WALLET_ID,
  AGENT_WALLET_ADDRESS,
  SERVICE_WALLET_ADDRESS,
  SERVICE_WALLET_ID,
  ARCSENSE_GATE_ADDRESS,
};