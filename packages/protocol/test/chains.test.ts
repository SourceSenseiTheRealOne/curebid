import { describe, expect, test } from "vitest";
import {
  SOURCE_CHAIN_ID,
  SETTLEMENT_CHAIN_ID,
  assertSupportedChain,
} from "../src/index.js";

describe("chain guards", () => {
  test("exposes the approved testnet chain ids", () => {
    expect(SOURCE_CHAIN_ID).toBe(11155111);
    expect(SETTLEMENT_CHAIN_ID).toBe(102031);
  });

  test("accepts only approved CureBid test networks", () => {
    expect(assertSupportedChain(11155111)).toBe("source");
    expect(assertSupportedChain(102031)).toBe("settlement");
    expect(() => assertSupportedChain(1)).toThrow(/unsupported/i);
    expect(() => assertSupportedChain(5)).toThrow(/unsupported/i);
  });
});
