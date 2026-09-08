import { SOURCE_CHAIN_ID } from "./chains.js";
export type OutcomeLog = { emitter: string; kind: "DebtRepaid"; digest: string; borrower: string; provider: string; amount: bigint };
export type AaveLog = { emitter: string; kind: "AaveRepay"; asset: string; borrower: string; repayer: string; amount: bigint; useATokens: boolean };
export interface ReceiptPolicyInput { chainId: number; status: number; txHash: string; logs: readonly (OutcomeLog | AaveLog)[] }
export interface ExpectedRepayment { router: string; pool: string; asset: string; borrower: string; provider: string; amount: bigint; digest: string }
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** Business policy only. This function does NOT verify a cryptographic proof. */
export function verifyRepaymentReceipt(receipt: ReceiptPolicyInput, expected: ExpectedRepayment) {
  if (receipt.chainId !== SOURCE_CHAIN_ID) throw new Error("Wrong chain");
  if (receipt.status !== 1) throw new Error("Receipt status must be successful");
  const outcomes = receipt.logs.filter((log): log is OutcomeLog => log.kind === "DebtRepaid" && same(log.emitter, expected.router) && same(log.digest, expected.digest));
  if (outcomes.length !== 1) throw new Error("Missing or ambiguous router outcome");
  const outcome = outcomes[0]!;
  if (!same(outcome.borrower, expected.borrower) || !same(outcome.provider, expected.provider) || outcome.amount !== expected.amount) throw new Error("Wrong repayment terms");
  const aave = receipt.logs.filter((log): log is AaveLog => log.kind === "AaveRepay" && same(log.emitter, expected.pool) && same(log.asset, expected.asset) && same(log.borrower, expected.borrower) && same(log.repayer, expected.router) && log.amount === expected.amount && !log.useATokens);
  if (aave.length !== 1) throw new Error("Missing or ambiguous Aave repayment");
  return { chainId: receipt.chainId, receiptSucceeded: true, policyValidated: true, aaveRepay: aave[0]! };
}
