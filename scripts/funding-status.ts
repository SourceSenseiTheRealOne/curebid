// Public addresses only. Never loads private key storage.
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { JsonRpcProvider, formatEther } from "ethers";
import { SOURCE_RPC, SETTLEMENT_RPC } from "../packages/protocol/src/chains.js";
const addresses = JSON.parse(
  await readFile(
    `${homedir()}/.local/share/curebid/keys/public-addresses.json`,
    "utf8",
  ),
) as Record<string, string>;
const source = new JsonRpcProvider(SOURCE_RPC),
  destination = new JsonRpcProvider(SETTLEMENT_RPC);
try {
  for (const [role, address] of Object.entries(addresses)) {
    const [s, d] = await Promise.all([
      source.getBalance(address),
      destination.getBalance(address),
    ]);
    console.log(
      JSON.stringify({
        role,
        address,
        sepoliaETH: formatEther(s),
        testnetCTC: formatEther(d),
      }),
    );
  }
} finally {
  source.destroy();
  destination.destroy();
}
