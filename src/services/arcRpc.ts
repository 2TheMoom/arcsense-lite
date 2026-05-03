import { JsonRpcProvider } from "ethers";

let provider: JsonRpcProvider;

export function createProvider(rpcUrl: string) {
  provider = new JsonRpcProvider(rpcUrl);
  return provider;
}

export function getProvider() {
  if (!provider) {
    throw new Error("Provider not initialized");
  }
  return provider;
}