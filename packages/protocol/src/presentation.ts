import { parseAssetAmount } from "./amounts.js";
export type Phase =
  "open" | "assigned" | "proof-pending" | "settled" | "refunded" | "cancelled";
export function requestPhase(
  state: number,
  executeBy: number,
  now: number,
): Phase {
  if (state === 1) return "open";
  if (state === 2) return now > executeBy ? "proof-pending" : "assigned";
  if (state === 3) return "settled";
  if (state === 4) return "refunded";
  if (state === 5) return "cancelled";
  throw new Error("Unknown request state");
}
export function requestInput(
  amount: string,
  cap: string,
): { amount: bigint; cap: bigint } {
  const parsed = {
    amount: parseAssetAmount(amount, 6),
    cap: parseAssetAmount(cap, 18),
  };
  if (parsed.amount === 0n || parsed.cap === 0n)
    throw new Error("Enter positive amounts");
  return parsed;
}
