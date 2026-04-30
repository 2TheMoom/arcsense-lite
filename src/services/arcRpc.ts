import axios from "axios";
import { config } from "../config/env";

export async function getBlockNumber(): Promise<number> {
  const res = await axios.post(config.ARC_RPC_URL, {
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: 1,
  });

  return parseInt(res.data.result, 16);
}

export async function getBlockByNumber(blockNumber: number) {
  const hexBlock = "0x" + blockNumber.toString(16);

  const res = await axios.post(config.ARC_RPC_URL, {
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber",
    params: [hexBlock, true],
    id: 1,
  });

  return res.data.result;
}