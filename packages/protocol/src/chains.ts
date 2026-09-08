export const SOURCE_CHAIN_ID = 11155111;
export const SETTLEMENT_CHAIN_ID = 102031;
export const SOURCE_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
export const SETTLEMENT_RPC = "https://rpc.cc3-testnet.creditcoin.network";
export const PROVER_URL = "https://prover.cc3-testnet.creditcoin.network";
export const AAVE_POOL = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951";
export const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
export function assertSupportedChain(id: number): "source" | "settlement" {
  if (id === SOURCE_CHAIN_ID) return "source";
  if (id === SETTLEMENT_CHAIN_ID) return "settlement";
  throw new Error("Unsupported chain: testnets only");
}
