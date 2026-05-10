import * as https from "https";
import * as crypto from "crypto";

// ── Config ────────────────────────────────────────────────────
const API_KEY       = process.env.CIRCLE_API_KEY!;
const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET!;
const WALLET_ID     = process.env.CIRCLE_WALLET_ID!;
const QUERY_PRICE   = 0.1; // USDC

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
function circleRequest(
  method: string,
  path: string,
  body?: object
): Promise<any> {
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
            console.error("🔴 Circle API error:", JSON.stringify(parsed, null, 2));
          }
          resolve(parsed);
        } catch {
          console.error("🔴 Raw Circle response:", data);
          reject(new Error("Failed to parse Circle API response"));
        }
      });
    });

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Request USDC payment ──────────────────────────────────────
export async function requestPayment(
  fromWalletAddress: string,
  queryId: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    const body = {
      idempotencyKey:         crypto.randomUUID(),
      entitySecretCiphertext: generateCiphertext(),
      amounts:                [QUERY_PRICE.toFixed(2)],
      destinationAddress:     process.env.CIRCLE_WALLET_ADDRESS!,
      walletId:               WALLET_ID,
      blockchain:             "ARC-TESTNET",
      feeLevel:               "MEDIUM",
      refId:                  queryId,
    };

    const response = await circleRequest(
      "POST",
      "/v1/w3s/developer/transactions/transfer",
      body
    );

    if (response.data?.id) {
      console.log(`💸 Payment requested: ${response.data.id} for query ${queryId}`);
      return { success: true, txId: response.data.id };
    }

    return { success: false, error: response.message || "Payment failed" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Verify payment transaction ────────────────────────────────
export async function verifyPayment(
  txId: string
): Promise<{ confirmed: boolean; amount?: number }> {
  try {
    const response = await circleRequest(
      "GET",
      `/v1/w3s/developer/transactions/${txId}`
    );

    const tx = response.data?.transaction;
    if (!tx) return { confirmed: false };

    const confirmed = tx.state === "CONFIRMED" || tx.state === "COMPLETE";
    const amount    = parseFloat(tx.amounts?.[0] || "0");

    if (confirmed && amount >= QUERY_PRICE) {
      console.log(`✅ Payment confirmed: ${amount} USDC for tx ${txId}`);
      return { confirmed: true, amount };
    }

    return { confirmed: false };
  } catch (err: any) {
    console.error("Payment verification error:", err.message);
    return { confirmed: false };
  }
}

// ── Check wallet USDC balance ─────────────────────────────────
export async function getWalletBalance(
  walletId: string
): Promise<number> {
  try {
    const response = await circleRequest(
      "GET",
      `/v1/w3s/wallets/${walletId}/balances`
    );
    const tokens = response.data?.tokenBalances || [];
    const usdc   = tokens.find((t: any) => t.token?.symbol === "USDC");
    return parseFloat(usdc?.amount || "0");
  } catch {
    return 0;
  }
}

export { QUERY_PRICE };