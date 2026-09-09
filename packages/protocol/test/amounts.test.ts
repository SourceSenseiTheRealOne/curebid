import { describe, expect, test } from "vitest";
import { parseAssetAmount } from "../src/index.js";

describe("parseAssetAmount", () => {
  test("parses decimal input to exact base units", () => {
    expect(parseAssetAmount("300", 6)).toBe(300000000n);
    expect(parseAssetAmount("1.25", 6)).toBe(1250000n);
    expect(parseAssetAmount("0.000001", 6)).toBe(1n);
  });

  test("rejects non-canonical or imprecise amounts", () => {
    for (const input of [
      "1.0000001",
      "+1",
      "-1",
      "1e6",
      "01",
      "1.",
      ".1",
      "",
    ]) {
      expect(() => parseAssetAmount(input, 6), input).toThrow();
    }
  });

  test("rejects unsafe decimal configuration and uint256 overflow", () => {
    expect(() => parseAssetAmount("1", -1)).toThrow();
    expect(() => parseAssetAmount("1", 78)).toThrow();
    expect(() =>
      parseAssetAmount(
        "115792089237316195423570985008687907853269984665640564039458",
        18,
      ),
    ).toThrow();
  });
});
