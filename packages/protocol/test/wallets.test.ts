import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createFreshTestnetWallets } from "../src/wallets.js";

describe("fresh testnet wallets", () => {
  test("stores secret wallet material in owner-only state and exports only public addresses", async () => {
    const dir = await mkdtemp(join(tmpdir(), "curebid-wallet-test-"));
    try {
      const result = await createFreshTestnetWallets(dir);
      expect(result.publicAddresses.borrower).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(result.publicAddresses.providerA).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(result.publicAddresses.providerB).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(new Set(Object.values(result.publicAddresses)).size).toBe(3);

      const privateState = await stat(join(dir, "wallets.private.json"));
      expect((privateState.mode & 0o077).toString(8)).toBe("0");

      const publicJson = await readFile(join(dir, "public-addresses.json"), "utf8");
      expect(publicJson).not.toContain("privateKey");
      expect(publicJson).not.toContain("mnemonic");
      await expect(createFreshTestnetWallets(dir)).rejects.toThrow();
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
