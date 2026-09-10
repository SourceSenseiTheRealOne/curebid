// Live eth_call negative proofs. No signers and no network writes.
import { readFile, writeFile } from "node:fs/promises";
import { Contract, JsonRpcProvider } from "ethers";
import { proofProvider } from "@gluwa/usc-sdk";
import { validateDeployment } from "../packages/protocol/src/deployment.js";
import { SETTLEMENT_RPC, PROVER_URL } from "../packages/protocol/src/chains.js";
const d = validateDeployment(
  JSON.parse(await readFile("deployments/testnet.json", "utf8")),
);
const rpc = new JsonRpcProvider(SETTLEMENT_RPC);
try {
  if ((await rpc.getNetwork()).chainId !== 102031n)
    throw new Error("Wrong testnet");
  const result = await new proofProvider.service.ProofBuilder(
    d.chainKey,
    PROVER_URL,
  ).getProof(
    "0x7852c72318a698309a08a2a20277005fe899eb3f099ffeb7c0f5e1ea529a7620",
  );
  if (!result.success || !result.data)
    throw new Error("Historical owned proof unavailable");
  const p = result.data;
  const proof = {
    chainKey: p.chainKey,
    height: p.headerNumber,
    txBytes: p.txBytes,
    merkle: p.merkleProof,
    continuity: p.continuityProof,
  };
  await writeFile(
    "docs/evidence/owned-repayment-proof.json",
    JSON.stringify(proof, null, 2),
  );
  const m = new Contract(
      d.market,
      JSON.parse(await readFile("apps/web/lib/CureMarket.json", "utf8")),
      rpc,
    ),
    v = new Contract(
      d.verifier,
      JSON.parse(
        await readFile("apps/web/lib/AttestcoinVerifier.json", "utf8"),
      ),
      rpc,
    );
  const terms = Array.from(await m.getFunction("getTerms")(1));
  const outcomes: { test: string; rejected: boolean; reason: string }[] = [];
  async function reject(test: string, call: () => Promise<unknown>) {
    try {
      await call();
      throw new Error("NEGATIVE TEST ACCEPTED");
    } catch (e) {
      if (!(
        e &&
        typeof e === "object" &&
        "code" in e &&
        e.code === "CALL_EXCEPTION"
      ))
        throw e;
      outcomes.push({
        test,
        rejected: true,
        reason: String("reason" in e ? e.reason : "Contract reverted"),
      });
    }
  }
  await reject("settled request replay", () =>
    m.getFunction("settle").staticCall(1, proof),
  );
  const changed = [...terms];
  changed[8] = "0xbcB91e4fEE4B9cF74f780154B1a8176C42A88Af8";
  await reject("provider substitution with valid native proof", () =>
    v.getFunction("verify")(proof, changed),
  );
  const foreign = [...terms];
  foreign[2] = 2n;
  await reject("different request with valid native proof", () =>
    v.getFunction("verify")(proof, foreign),
  );
  await reject("wrong source chain key", () =>
    v.getFunction("verify")({ ...proof, chainKey: 3 }, terms),
  );
  await writeFile(
    "docs/evidence/live-negative-proofs.json",
    JSON.stringify(
      {
        scope:
          "Read-only eth_call against deployed contracts and real native proof; no malicious transactions broadcast",
        outcomes,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(outcomes, null, 2));
} finally {
  rpc.destroy();
}
