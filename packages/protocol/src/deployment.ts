import { getAddress, ZeroAddress } from "ethers";
export interface Deployment {
  sourceChainId: 11155111;
  settlementChainId: 102031;
  chainKey: number;
  router: string;
  market: string;
  verifier: string;
  debtToken: string;
  sourceBlock: number;
  settlementBlock: number;
}
export function validateDeployment(value: unknown): Deployment {
  if (!value || typeof value !== "object")
    throw new Error("No deployment configured");
  const v = value as Record<string, unknown>;
  if (v.sourceChainId !== 11155111 || v.settlementChainId !== 102031)
    throw new Error("Testnet deployment required");
  for (const k of ["router", "market", "verifier", "debtToken"]) {
    if (typeof v[k] !== "string" || getAddress(v[k] as string) === ZeroAddress)
      throw new Error("Invalid deployment address");
  }
  for (const k of ["chainKey", "sourceBlock", "settlementBlock"]) {
    if (
      typeof v[k] !== "number" ||
      !Number.isSafeInteger(v[k]) ||
      (v[k] as number) <= 0
    )
      throw new Error("Invalid deployment identity");
  }
  return v as unknown as Deployment;
}
