import { homedir } from "node:os";
import { join } from "node:path";
import { createFreshTestnetWallets } from "../packages/protocol/src/wallets.js";
console.log(JSON.stringify(await createFreshTestnetWallets(join(homedir(), ".local/share/curebid/keys")), null, 2));
