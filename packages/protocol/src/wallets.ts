import { Wallet, randomBytes, hexlify } from "ethers";
import { mkdir, lstat, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Node-only. Fresh testnet custody, never imported by the browser package. */
export async function createFreshTestnetWallets(directory: string) {
  if (process.platform !== "linux" || directory.startsWith("/mnt/")) throw new Error("Use protected native Linux storage");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error("Unsafe custody directory");
  const roles = ["borrower", "providerA", "providerB"] as const;
  const wallets = roles.map((role) => ({ role, wallet: new Wallet(hexlify(randomBytes(32))) }));
  const secretPath = join(directory, "wallets.private.json");
  await writeFile(secretPath, JSON.stringify(Object.fromEntries(wallets.map(({ role, wallet }) => [role, wallet.privateKey]))), { mode: 0o600, flag: "wx" });
  const publicAddresses = Object.fromEntries(wallets.map(({ role, wallet }) => [role, wallet.address])) as Record<(typeof roles)[number], string>;
  await writeFile(join(directory, "public-addresses.json"), JSON.stringify(publicAddresses, null, 2), { mode: 0o600, flag: "wx" });
  return { publicAddresses, secretPath };
}
