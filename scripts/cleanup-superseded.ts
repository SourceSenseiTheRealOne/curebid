// Bounded cleanup of the superseded trial escrow. Never changes active deployment.
import { readFile, lstat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { Wallet, Contract, JsonRpcProvider } from "ethers";
import { proofProvider } from "@gluwa/usc-sdk";
if (process.argv[2] !== "--testnet")
  throw new Error("Explicit --testnet required");
const d = JSON.parse(
  await readFile("deployments/superseded-fixed-rounding/testnet.json", "utf8"),
);
if (
  d.market !== "0x763C8394bb33E64F84395E99e3C416f05C06a2D2" ||
  d.router !== "0xA29c1d1F62634665740F1DDA7F1a39F95BA69c1e"
)
  throw new Error("Unexpected superseded identity");
const source = new JsonRpcProvider(
    "https://ethereum-sepolia-rpc.publicnode.com",
  ),
  dest = new JsonRpcProvider("https://rpc.cc3-testnet.creditcoin.network");
const delay = () => new Promise((r) => setTimeout(r, 60000));
try {
  if (
    (await source.getNetwork()).chainId !== 11155111n ||
    (await dest.getNetwork()).chainId !== 102031n
  )
    throw new Error("Testnet mismatch");
  const path = `${homedir()}/.local/share/curebid/keys/wallets.private.json`;
  const info = await lstat(path);
  if (
    process.platform !== "linux" ||
    info.isSymbolicLink() ||
    (info.mode & 0o077) !== 0 ||
    info.uid !== process.getuid?.()
  )
    throw new Error("Unsafe custody");
  const keys = JSON.parse(await readFile(path, "utf8"));
  const s = new Wallet(keys.borrower, source),
    t = new Wallet(keys.borrower, dest);
  const m = new Contract(
      d.market,
      JSON.parse(await readFile("apps/web/lib/CureMarket.json", "utf8")),
      t,
    ),
    r = new Contract(
      d.router,
      JSON.parse(await readFile("apps/web/lib/CureRouter.json", "utf8")),
      s,
    );
  const terms = Array.from(await m.getFunction("getTerms")(1));
  const q = await m.getFunction("getRequest")(1);
  if (q.borrower.toLowerCase() !== s.address.toLowerCase())
    throw new Error("Wrong credit owner");
  for (let i = 0; i < 120; i++) {
    const state = Number((await m.getFunction("getRequest")(1)).state);
    if (state === 4) break;
    if (state !== 2) throw new Error("Unexpected old request state");
    const outcome = Number(await r.getFunction("outcome")(q.digest));
    if (outcome === 1) throw new Error("Old request repaid: must not refund");
    if (outcome === 0) {
      const block = await source.getBlock("latest");
      if (!block) throw new Error("No source block");
      if (BigInt(block.timestamp) <= q.executeBy) {
        if (i % 10 === 0)
          console.log(
            "Awaiting authentic source expiry deadline",
            String(q.executeBy),
          );
        await delay();
        continue;
      }
      await r.getFunction("expire").staticCall(terms);
      const tx = await r.getFunction("expire")(terms, { type: 2 });
      console.log("Legacy expiry", tx.hash);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1)
        throw new Error("Expiry receipt failed");
    }
    const logs = await source.getLogs({
      address: d.router,
      fromBlock: d.sourceBlock,
      toBlock: "latest",
      topics: [r.interface.getEvent("ExecutionExpired")!.topicHash, q.digest],
    });
    if (logs.length !== 1) throw new Error("Missing or ambiguous old expiry");
    const proof = await new proofProvider.service.ProofBuilder(
      d.chainKey,
      "https://prover.cc3-testnet.creditcoin.network",
    ).getProof(logs[0]!.transactionHash);
    if (!proof.success || !proof.data) {
      await delay();
      continue;
    }
    const p = proof.data;
    const value = {
      chainKey: p.chainKey,
      height: p.headerNumber,
      txBytes: p.txBytes,
      merkle: p.merkleProof,
      continuity: p.continuityProof,
    };
    await m.getFunction("settle").staticCall(1, value);
    const tx = await m.getFunction("settle")(1, value);
    console.log("Legacy refund", tx.hash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1)
      throw new Error("Refund receipt failed");
  }
  if (Number((await m.getFunction("getRequest")(1)).state) !== 4)
    throw new Error("Cleanup deadline exceeded");
  if ((await m.getFunction("credits")(t.address)) > 0n) {
    const tx = await m.getFunction("withdraw")(t.address);
    console.log("Legacy withdrawal", tx.hash);
    await tx.wait();
  }
  const reserved = await m.getFunction("reserved")(),
    credit = await m.getFunction("credits")(t.address);
  if (reserved !== 0n || credit !== 0n)
    throw new Error("Legacy funds still reserved");
  await writeFile(
    "docs/evidence/superseded-cleanup.json",
    JSON.stringify(
      {
        market: d.market,
        requestId: "1",
        state: 4,
        reserved: "0",
        borrowerCredit: "0",
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log("Superseded escrow refunded and cleared");
} finally {
  source.destroy();
  dest.destroy();
}
