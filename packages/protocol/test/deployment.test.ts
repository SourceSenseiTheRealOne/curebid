import { test, expect } from "vitest";
import { validateDeployment } from "../src/deployment.js";
import { hashTerms } from "../src/terms.js";
test("deployment rejects mainnet and zero contracts", () => {
  expect(() => validateDeployment({ sourceChainId: 1 })).toThrow();
  expect(() =>
    validateDeployment({
      sourceChainId: 11155111,
      settlementChainId: 102031,
      router: "0x",
    }),
  ).toThrow();
});
test("terms bind every field", () => {
  const t = [
    102031n,
    "0x0000000000000000000000000000000000000001",
    1n,
    11155111n,
    "0x0000000000000000000000000000000000000002",
    "0x0000000000000000000000000000000000000003",
    "0x0000000000000000000000000000000000000004",
    "0x0000000000000000000000000000000000000005",
    "0x0000000000000000000000000000000000000006",
    300000000n,
    2000000000n,
  ] as const;
  const h = hashTerms(t);
  for (let i = 0; i < t.length; i++) {
    const m = [...t];
    m[i] =
      typeof m[i] === "bigint"
        ? (m[i] as bigint) + 1n
        : "0x0000000000000000000000000000000000000009";
    expect(hashTerms(m)).not.toBe(h);
  }
});
