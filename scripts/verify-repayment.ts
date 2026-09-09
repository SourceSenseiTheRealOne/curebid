// Read-only historical feasibility probe. No signer or custody import.
import type * as EthersCjs from "ethers" with { "resolution-mode": "require" };
import { createRequire } from "node:module";
const ethers: typeof EthersCjs = createRequire(import.meta.url)("ethers");
const { JsonRpcProvider, Interface } = ethers;
import {
  chainInfo,
  blockProver,
  proofProvider,
  encoding,
} from "@gluwa/usc-sdk";
import { mkdir, writeFile } from "node:fs/promises";
import {
  SOURCE_RPC,
  SETTLEMENT_RPC,
  SOURCE_CHAIN_ID,
  SETTLEMENT_CHAIN_ID,
  AAVE_POOL,
  USDC,
  PROVER_URL,
} from "../packages/protocol/src/index.js";
const source = new JsonRpcProvider(SOURCE_RPC),
  destination = new JsonRpcProvider(SETTLEMENT_RPC);
const iface = new Interface([
  "event Repay(address indexed reserve,address indexed user,address indexed repayer,uint256 amount,bool useATokens)",
]);
try {
  if (
    (await source.getNetwork()).chainId !== BigInt(SOURCE_CHAIN_ID) ||
    (await destination.getNetwork()).chainId !== BigInt(SETTLEMENT_CHAIN_ID)
  )
    throw new Error("Testnet chain mismatch");
  const info = new chainInfo.PrecompileChainInfoProvider(destination);
  const supported = (await info.getSupportedChains()).find(
    (c) => c.chainId === SOURCE_CHAIN_ID && c.chainEncoding === 1,
  );
  if (!supported) throw new Error("Sepolia is not attested");
  let hash = process.argv[2];
  if (hash && !/^0x[0-9a-fA-F]{64}$/.test(hash))
    throw new Error("Invalid transaction hash");
  if (!hash) {
    const latest = await info.getLatestAttestedHeightAndHash(
      supported.chainKey,
    );
    for (let end = latest.height, i = 0; i < 20 && !hash; i++, end -= 3000) {
      const logs = await source.getLogs({
        address: AAVE_POOL,
        topics: [
          iface.getEvent("Repay")!.topicHash,
          "0x" + USDC.slice(2).toLowerCase().padStart(64, "0"),
        ],
        fromBlock: Math.max(0, end - 2999),
        toBlock: end,
      });
      hash = logs.at(-1)?.transactionHash;
    }
  }
  if (!hash) throw new Error("No recent Aave USDC repayment in bounded scan");
  console.log("Historical Aave candidate:", hash);
  const [tx, receipt] = await Promise.all([
    encoding.getTransactionWithRaw(source, hash),
    source.getTransactionReceipt(hash),
  ]);
  if (!tx || !receipt || receipt.status !== 1)
    throw new Error("Missing or failed source receipt");
  const logs = receipt.logs
    .filter((l) => l.address.toLowerCase() === AAVE_POOL.toLowerCase())
    .map((l) => {
      try {
        return iface.parseLog(l);
      } catch {
        return null;
      }
    })
    .filter(
      (l) =>
        l?.name === "Repay" &&
        l.args[0].toLowerCase() === USDC.toLowerCase() &&
        l.args[3] > 0n &&
        l.args[4] === false,
    );
  if (!logs.length) throw new Error("No authentic Aave USDC repayment");
  const result = await new proofProvider.service.ProofBuilder(
    supported.chainKey,
    PROVER_URL,
  ).getProof(hash);
  if (!result.success || !result.data)
    throw new Error(
      "Proof service did not return proof: " + JSON.stringify(result),
    );
  const p = result.data;
  if (
    p.chainKey !== supported.chainKey ||
    p.headerNumber !== receipt.blockNumber ||
    p.txBytes.toLowerCase() !==
      encoding.abiEncode(tx, receipt).abi.toLowerCase()
  )
    throw new Error("Proof bytes do not match source transaction and receipt");
  const prover = new blockProver.PrecompileBlockProver(destination);
  const verified = await prover.verifySingle(
    p.chainKey,
    p.headerNumber,
    p.txBytes,
    p.merkleProof,
    p.continuityProof,
  );
  if (!verified) throw new Error("Actual precompile rejected proof");
  const index = await prover.computeTransactionIndex(p.merkleProof);
  if (Number(index) !== receipt.index)
    throw new Error("Proof transaction index mismatch");
  const evidence = {
    provenance: "third-party historical Aave repayment; NOT CureBid execution",
    checkedAt: new Date().toISOString(),
    sourceChainId: SOURCE_CHAIN_ID,
    settlementChainId: SETTLEMENT_CHAIN_ID,
    chainKey: p.chainKey,
    transactionHash: hash,
    sourceBlock: receipt.blockNumber,
    transactionIndex: receipt.index,
    precompileVerified: verified,
    pool: AAVE_POOL,
    repayments: logs.map((l) => ({
      borrower: l!.args[1],
      repayer: l!.args[2],
      amount: String(l!.args[3]),
      asset: USDC,
    })),
    proof: p,
  };
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/historical-proof.json",
    JSON.stringify(
      evidence,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { ...evidence, proof: "saved to docs/evidence/historical-proof.json" },
      null,
      2,
    ),
  );
} finally {
  source.destroy();
  destination.destroy();
}
