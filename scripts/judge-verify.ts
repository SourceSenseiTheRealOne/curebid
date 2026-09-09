// Public, read-only deployment verification. Does not import wallet custody.
import { readFile } from "node:fs/promises";
import { Contract, JsonRpcProvider } from "ethers";
import { validateDeployment } from "../packages/protocol/src/deployment.js";
import {
  SOURCE_RPC,
  SETTLEMENT_RPC,
  AAVE_POOL,
  USDC,
} from "../packages/protocol/src/chains.js";
const source = new JsonRpcProvider(SOURCE_RPC),
  destination = new JsonRpcProvider(SETTLEMENT_RPC);
try {
  let raw: string;
  try {
    raw = await readFile("deployments/testnet.json", "utf8");
  } catch {
    throw new Error(
      "No CureBid testnet deployment recorded. Funding and live execution remain incomplete.",
    );
  }
  const d = validateDeployment(JSON.parse(raw));
  if (
    (await source.getNetwork()).chainId !== 11155111n ||
    (await destination.getNetwork()).chainId !== 102031n
  )
    throw new Error("RPC chain mismatch");
  for (const [address, rpc] of [
    [d.router, source],
    [d.market, destination],
    [d.verifier, destination],
  ] as const)
    if ((await rpc.getCode(address)) === "0x")
      throw new Error("Missing deployed code");
  const ma = JSON.parse(await readFile("apps/web/lib/CureMarket.json", "utf8"));
  const ra = JSON.parse(await readFile("apps/web/lib/CureRouter.json", "utf8"));
  const va = JSON.parse(
    await readFile("apps/web/lib/AttestcoinVerifier.json", "utf8"),
  );
  const m = new Contract(d.market, ma, destination),
    r = new Contract(d.router, ra, source),
    v = new Contract(d.verifier, va, destination);
  async function address(c: Contract, name: string, expected: string) {
    if ((await c.getFunction(name)()).toLowerCase() !== expected.toLowerCase())
      throw new Error(`${name} identity mismatch`);
  }
  await Promise.all([
    address(m, "router", d.router),
    address(m, "verifier", d.verifier),
    address(m, "pool", AAVE_POOL),
    address(m, "asset", USDC),
    address(r, "pool", AAVE_POOL),
    address(r, "asset", USDC),
    address(r, "debtToken", d.debtToken),
    address(v, "router", d.router),
    address(v, "pool", AAVE_POOL),
    address(v, "asset", USDC),
  ]);
  if (Number(await v.getFunction("chainKey")()) !== d.chainKey)
    throw new Error("Proof chain key mismatch");
  const reserved: bigint = await m.getFunction("reserved")(),
    credits: bigint = await m.getFunction("totalCredits")();
  if ((await destination.getBalance(d.market)) < reserved + credits)
    throw new Error("Escrow insolvent");
  const next: bigint = await m.getFunction("nextId")();
  const states = [];
  for (let id = 1n; id < next && id <= 100n; id++) {
    const q = await m.getFunction("getRequest")(id);
    states.push({
      id: String(id),
      state: Number(q.state),
      digest: q.digest,
      provider: q.provider,
      reimbursement: String(q.reimbursement),
      sourceOutcome:
        Number(q.state) >= 2 && Number(q.state) !== 5
          ? Number(await r.getFunction("outcome")(q.digest))
          : 0,
    });
  }
  console.log(
    JSON.stringify(
      {
        deploymentVerified: true,
        scope:
          "Contract configuration, solvency and up to 100 request state readbacks; not a claim that every demo criterion is complete",
        deployment: d,
        reserved: String(reserved),
        credits: String(credits),
        requests: states,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : "Verification failed");
  process.exitCode = 1;
} finally {
  source.destroy();
  destination.destroy();
}
