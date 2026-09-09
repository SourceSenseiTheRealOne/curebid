import { describe, expect, test } from "vitest";
import { verifyRepaymentReceipt } from "../src/index.js";

const router = "0x1000000000000000000000000000000000000001";
const pool = "0x2000000000000000000000000000000000000002";
const asset = "0x3000000000000000000000000000000000000003";
const borrower = "0x4000000000000000000000000000000000000004";
const provider = "0x5000000000000000000000000000000000000005";
const digest =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const baseReceipt = {
  chainId: 11155111,
  status: 1,
  txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  logs: [
    {
      emitter: router,
      kind: "DebtRepaid",
      digest,
      borrower,
      provider,
      amount: 300000000n,
    },
    {
      emitter: pool,
      kind: "AaveRepay",
      asset,
      borrower,
      repayer: router,
      amount: 300000000n,
      useATokens: false,
    },
  ],
} as const;

describe("repayment proof policy", () => {
  test("requires successful Sepolia receipt with authenticated router and Aave Pool logs", () => {
    expect(
      verifyRepaymentReceipt(baseReceipt, {
        router,
        pool,
        asset,
        borrower,
        provider,
        amount: 300000000n,
        digest,
      }),
    ).toMatchObject({
      chainId: 11155111,
      receiptSucceeded: true,
      policyValidated: true,
      aaveRepay: { amount: 300000000n, useATokens: false },
    });
  });

  test("receipt validation alone never claims precompile verification", () => {
    expect(
      verifyRepaymentReceipt(baseReceipt, {
        router,
        pool,
        asset,
        borrower,
        provider,
        amount: 300000000n,
        digest,
      }),
    ).not.toHaveProperty("precompileVerified");
  });

  test("rejects receipt failure, wrong chain, and foreign Aave emitter", () => {
    expect(() =>
      verifyRepaymentReceipt(
        { ...baseReceipt, status: 0 },
        { router, pool, asset, borrower, provider, amount: 300000000n, digest },
      ),
    ).toThrow(/status/i);
    expect(() =>
      verifyRepaymentReceipt(
        { ...baseReceipt, chainId: 1 },
        { router, pool, asset, borrower, provider, amount: 300000000n, digest },
      ),
    ).toThrow(/chain/i);
    expect(() =>
      verifyRepaymentReceipt(
        {
          ...baseReceipt,
          logs: [
            baseReceipt.logs[0],
            { ...baseReceipt.logs[1], emitter: provider },
          ],
        },
        { router, pool, asset, borrower, provider, amount: 300000000n, digest },
      ),
    ).toThrow(/aave/i);
  });
});
