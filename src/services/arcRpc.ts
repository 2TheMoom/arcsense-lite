import axios from "axios";

const RPC = "https://rpc.testnet.arc.network";

export async function getLatestBlock(): Promise<any> {
  const res = await axios.post(RPC, {
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber",
    params: ["latest", true],
    id: 1,
  });

  return res.data.result;
}

export async function getTransactionReceipt(hash: string): Promise<any> {
  const res = await axios.post(RPC, {
    jsonrpc: "2.0",
    method: "eth_getTransactionReceipt",
    params: [hash],
    id: 1,
  });

  return res.data.result;
}