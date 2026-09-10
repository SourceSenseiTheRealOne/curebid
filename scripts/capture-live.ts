// Public read-only evidence, including source receipts and ledger readback.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { Contract, JsonRpcProvider } from "ethers";
import { validateDeployment } from "../packages/protocol/src/deployment.js";
import { SOURCE_RPC, SETTLEMENT_RPC } from "../packages/protocol/src/chains.js";
const d = validateDeployment(
  JSON.parse(await readFile("deployments/testnet.json", "utf8")),
);
const source = new JsonRpcProvider(SOURCE_RPC),
  destination = new JsonRpcProvider(SETTLEMENT_RPC);
try {
  if (
    (await source.getNetwork()).chainId !== 11155111n ||
    (await destination.getNetwork()).chainId !== 102031n
  )
    throw new Error("Testnet mismatch");
  const m = new Contract(
    d.market,
    JSON.parse(await readFile("apps/web/lib/CureMarket.json", "utf8")),
    destination,
  );
  const r = new Contract(
    d.router,
    JSON.parse(await readFile("apps/web/lib/CureRouter.json", "utf8")),
    source,
  );
  const requests = [];
  const next: bigint = await m.getFunction("nextId")();
  if (next > 101n) throw new Error("Evidence request bound exceeded");
  for (let id = 1n; id < next; id++) {
    const q = await m.getFunction("getRequest")(id);
    const providers: string[] = await m.getFunction("getProviders")(id);
    const quotes = await Promise.all(
      providers.map(async (provider) => ({
        provider,
        reimbursement: String(await m.getFunction("quotes")(id, provider)),
      })),
    );
    const sourceOutcome = Number(await r.getFunction("outcome")(q.digest));
    const sourceLogs = sourceOutcome
      ? await source.getLogs({
          address: d.router,
          fromBlock: d.sourceBlock,
          toBlock: "latest",
          topics: [
            r.interface.getEvent(
              sourceOutcome === 1 ? "DebtRepaid" : "ExecutionExpired",
            )!.topicHash,
            q.digest,
          ],
        })
      : [];
    const txs = await Promise.all(
      sourceLogs.map(async (log) => {
        const receipt = await source.getTransactionReceipt(log.transactionHash);
        if (!receipt || receipt.status !== 1)
          throw new Error("Outcome receipt not successful");
        return {
          hash: receipt.hash,
          block: receipt.blockNumber,
          status: receipt.status,
          logs: receipt.logs.map((l) => ({
            address: l.address,
            topics: l.topics,
            data: l.data,
          })),
        };
      }),
    );
    const close = await destination.getLogs({
      address: d.market,
      fromBlock: d.settlementBlock,
      toBlock: "latest",
      topics: [
        m.interface.getEvent("RequestClosed")!.topicHash,
        "0x" + id.toString(16).padStart(64, "0"),
      ],
    });
    requests.push({
      id: String(id),
      state: Number(q.state),
      borrower: q.borrower,
      provider: q.provider,
      amount: String(q.amount),
      cap: String(q.cap),
      reimbursement: String(q.reimbursement),
      executeBy: Number(q.executeBy),
      digest: q.digest,
      quotes,
      sourceOutcome,
      sourceTransactions: txs,
      settlementTransactions: close.map((l) => l.transactionHash),
    });
  }
  const reserved = await m.getFunction("reserved")(),
    credits = await m.getFunction("totalCredits")(),
    balance = await destination.getBalance(d.market);
  if (balance < reserved + credits) throw new Error("Insolvent escrow");
  const evidence = {
    checkedAt: new Date().toISOString(),
    provenance:
      "CureBid-owned public testnet execution; real receipts and chain readback",
    deployment: d,
    requests,
    ledger: {
      reserved: String(reserved),
      credits: String(credits),
      balance: String(balance),
    },
  };
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/live-execution.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  await writeFile(
    "apps/web/public/evidence.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      requests: requests.map((q) => ({
        id: q.id,
        state: q.state,
        sourceOutcome: q.sourceOutcome,
      })),
      ledger: evidence.ledger,
    }),
  );
} finally {
  source.destroy();
  destination.destroy();
}
