"use client";
import { useEffect, useState } from "react";
import { Contract, JsonRpcProvider, formatUnits, parseUnits } from "ethers";
import {
  deployment,
  readRequests,
  phase,
  marketAbi,
  routerAbi,
  SOURCE_RPC,
  DEST_RPC,
  USDC,
  type RequestView,
} from "../lib/chain";
import type { Deployment } from "../../../packages/protocol/src/deployment";
import { requestInput } from "../../../packages/protocol/src/presentation";
import { useWallet } from "./Wallet";
import Mechanism from "./Mechanism";
export function Market({
  mode,
  id,
}: {
  mode: "home" | "repay" | "providers" | "request" | "verify";
  id?: string;
}) {
  const wallet = useWallet();
  const [config, setConfig] = useState<Deployment | null>(null),
    [rows, setRows] = useState<RequestView[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [readAt, setReadAt] = useState("");
  const [amount, setAmount] = useState(""),
    [cap, setCap] = useState(""),
    [quote, setQuote] = useState(""),
    [txHash, setTxHash] = useState(""),
    [debt, setDebt] = useState<string | null>(null);
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const d = await deployment();
      setConfig(d);
      if (d) setRows(await readRequests(d, id));
      else setRows([]);
      setReadAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [id]);
  useEffect(() => {
    setDebt(null);
    if (!wallet.address) return;
    let live = true;
    const rpc = new JsonRpcProvider(SOURCE_RPC);
    const token = new Contract(
      "0x36B5dE936eF1710E1d22EabE5231b28581a92ECc",
      ["function balanceOf(address) view returns(uint256)"],
      rpc,
    );
    void token
      .getFunction("balanceOf")(wallet.address)
      .then((v: bigint) => {
        if (live) setDebt(formatUnits(v, 6));
      })
      .catch(() => {
        if (live) setDebt("Unavailable");
      })
      .finally(() => rpc.destroy());
    return () => {
      live = false;
    };
  }, [wallet.address, readAt]);
  let validation = "";
  try {
    if (amount || cap) requestInput(amount, cap);
  } catch (e) {
    validation = message(e);
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("Waiting for wallet confirmation…");
    try {
      await fn();
      setStatus("Transaction confirmed. State read back from chain.");
      await refresh();
    } catch (e) {
      setError(message(e));
      setStatus("");
    } finally {
      setBusy(false);
    }
  }
  async function send(method: string, args: unknown[] = [], value?: bigint) {
    if (!config) throw new Error("No deployment configured");
    const signer = await wallet.signer(102031);
    const c = new Contract(config.market, marketAbi, signer);
    const overrides = value === undefined ? {} : { value };
    await c.getFunction(method).staticCall(...args, overrides);
    const tx = await c.getFunction(method)(...args, overrides);
    setStatus(`Confirming ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1)
      throw new Error("Transaction not confirmed");
  }
  async function fund() {
    const parsed = requestInput(amount, cap);
    const rpc = new JsonRpcProvider(DEST_RPC);
    try {
      const block = await rpc.getBlock("latest");
      if (!block) throw new Error("Latest block unavailable");
      await send(
        "createRequest",
        [parsed.amount, block.timestamp + 1800, block.timestamp + 7200],
        parsed.cap,
      );
    } finally {
      rpc.destroy();
    }
  }
  async function execute(r: RequestView, expire = false) {
    if (!config) throw new Error("No deployment configured");
    const dest = new JsonRpcProvider(DEST_RPC);
    try {
      const market = new Contract(config.market, marketAbi, dest);
      const current = await market.getFunction("getRequest")(r.id);
      if (Number(current.state) !== 2)
        throw new Error("Request is no longer assigned");
      const terms = Array.from(await market.getFunction("getTerms")(r.id));
      const s = await wallet.signer(11155111);
      const router = new Contract(config.router, routerAbi, s);
      if (!expire) {
        if ((await s.getAddress()).toLowerCase() !== r.provider.toLowerCase())
          throw new Error("Selected provider only");
        const token = new Contract(
          USDC,
          [
            "function approve(address,uint256) returns(bool)",
            "function allowance(address,address) view returns(uint256)",
          ],
          s,
        );
        if (
          (await token.getFunction("allowance")(r.provider, config.router)) <
          r.amount
        ) {
          const approval = await token.getFunction("approve")(
            config.router,
            r.amount,
            { type: 2 },
          );
          await approval.wait();
        }
      }
      const method = expire ? "expire" : "repay";
      await router.getFunction(method).staticCall(terms);
      const tx = await router.getFunction(method)(terms, { type: 2 });
      setStatus(`Confirming source transaction ${tx.hash}`);
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1)
        throw new Error("Source transaction not confirmed");
      setTxHash(tx.hash);
    } finally {
      dest.destroy();
    }
  }
  async function settle(r: RequestView) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash))
      throw new Error("Enter a source transaction hash");
    setStatus("Requesting native Attestcoin proof…");
    const response = await fetch("/api/proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: txHash }),
    });
    const data = (await response.json()) as { proof?: unknown; error?: string };
    if (!response.ok || !data.proof)
      throw new Error(
        data.error ?? "Proof unavailable; retry after attestation",
      );
    await send("settle", [r.id, data.proof]);
  }
  const disabled = busy || !config || !wallet.address || (!!error && loading);
  return (
    <section className={mode === "home" ? "market-preview" : "workspace"}>
      {mode !== "home" && (
        <div className="page-title">
          <span className="eyebrow">Sepolia → Creditcoin CC3 Testnet</span>
          <h1>
            {mode === "repay"
              ? "Keep your position. Reduce your debt."
              : mode === "providers"
                ? "Put your liquidity to work."
                : mode === "verify"
                  ? "Verify the result. Not the promise."
                  : `Repayment request #${id}`}
          </h1>
          <p>
            {mode === "providers"
              ? "Compete on a fixed CTC quote. Repay only after you are selected."
              : mode === "verify"
                ? "Public configuration and reproducible checks. No wallet or private key required."
                : "Actual Aave debt repayment, reimbursed only after authenticated proof."}
          </p>
        </div>
      )}
      <div className="read-status">
        <span>
          {loading
            ? "Reading chain state…"
            : config
              ? `Last read ${readAt}${error ? " · stale" : ""}`
              : "No deployment configured"}
        </span>
        <button onClick={() => void refresh()} disabled={loading || busy}>
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      {!config && !loading && (
        <p className="notice">
          Testnet deployment is awaiting funding. No balances, quotes or
          successful settlements are simulated.
        </p>
      )}
      {mode === "repay" && (
        <div className="operation-grid">
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              void action(fund);
            }}
          >
            <h2>Create a repayment request</h2>
            <p>
              Your Aave USDC debt:{" "}
              <strong>
                {wallet.address
                  ? (debt ?? "Reading…")
                  : "Connect wallet to read"}
              </strong>
            </p>
            <label htmlFor="amount">Repayment amount (USDC)</label>
            <input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="300"
            />
            <label htmlFor="cap">Maximum reimbursement (CTC)</label>
            <input
              id="cap"
              inputMode="decimal"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="2"
            />
            <p className="helper">
              Quotes close in 30 minutes. Execution window: 2 hours. CTC is not
              a USD price.
            </p>
            {validation && <p role="alert">{validation}</p>}
            <button
              className="primary"
              disabled={
                disabled ||
                !!validation ||
                !amount ||
                !cap ||
                wallet.chain !== 102031
              }
            >
              Fund request
            </button>
            <p className="helper">
              Use Creditcoin CC3 Testnet to fund escrow. Unselected requests can
              be cancelled.
            </p>
          </form>
          <Mechanism />
        </div>
      )}
      {mode === "verify" && (
        <div className="panel">
          <h2>Public verification</h2>
          <p>Run the read-only verifier against the deployment manifest:</p>
          <pre>pnpm judge:verify</pre>
          {config ? (
            <dl>
              {Object.entries(config).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>There is no CureBid deployment to verify yet.</p>
          )}
          <p>
            Historical Aave proof is feasibility evidence, not a CureBid
            repayment.
          </p>
          <a href="https://github.com/SourceSenseiTheRealOne/curebid">
            Source and verification instructions ↗
          </a>
        </div>
      )}
      {mode !== "verify" && (
        <>
          <div className="section-heading">
            <h2>
              {mode === "providers"
                ? "Latest requests"
                : "Repayment marketplace"}
            </h2>
            {mode === "home" && (
              <a className="primary button" href="/repay">
                Create request
              </a>
            )}
          </div>
          {!loading && rows.length === 0 && (
            <div className="empty">
              <span className="empty-mark" aria-hidden="true">
                ↔
              </span>
              <h3>No requests yet</h3>
              <p>
                Once deployed, funded requests and real provider quotes appear
                here.
              </p>
            </div>
          )}
          {rows.map((r) => (
            <article className="request panel" key={r.id}>
              <div className="request-title">
                <a href={`/requests/${r.id}`}>Request #{r.id}</a>
                <strong>{phase(r)}</strong>
              </div>
              <div className="amount-pair">
                <div>
                  <span>Repayment target</span>
                  <b>
                    {formatUnits(r.amount, 6)} <small>USDC</small>
                  </b>
                </div>
                <div>
                  <span>Maximum reimbursement</span>
                  <b>
                    {formatUnits(r.cap, 18)} <small>CTC</small>
                  </b>
                </div>
              </div>
              <p className="address">Borrower {r.borrower}</p>
              <p>
                Quote close: {new Date(r.quoteBy * 1000).toLocaleString()}
                <br />
                Execution deadline:{" "}
                {new Date(r.executeBy * 1000).toLocaleString()}
              </p>
              {r.state === 1 && (
                <>
                  <label htmlFor={`quote-${r.id}`}>
                    Your total quote (CTC)
                  </label>
                  <div className="inline-form">
                    <input
                      id={`quote-${r.id}`}
                      value={quote}
                      inputMode="decimal"
                      onChange={(e) => setQuote(e.target.value)}
                    />
                    <button
                      disabled={disabled || wallet.chain !== 102031}
                      onClick={() =>
                        void action(async () => {
                          const q = parseUnits(quote, 18);
                          if (q <= 0n || q > r.cap)
                            throw new Error(
                              "Quote must be positive and within the cap",
                            );
                          await send("submitQuote", [r.id, q]);
                        })
                      }
                    >
                      Submit quote
                    </button>
                  </div>
                  {r.quotes.map((q) => (
                    <div className="quote" key={q.provider}>
                      <code>{q.provider}</code>
                      <strong>{formatUnits(q.amount, 18)} CTC</strong>
                      <button
                        disabled={
                          disabled ||
                          wallet.chain !== 102031 ||
                          wallet.address.toLowerCase() !==
                            r.borrower.toLowerCase()
                        }
                        onClick={() =>
                          void action(() =>
                            send("acceptQuote", [r.id, q.provider, q.amount]),
                          )
                        }
                      >
                        Select quote
                      </button>
                    </div>
                  ))}
                  {wallet.address.toLowerCase() ===
                    r.borrower.toLowerCase() && (
                    <button
                      disabled={disabled || wallet.chain !== 102031}
                      onClick={() =>
                        void action(() => send("cancelRequest", [r.id]))
                      }
                    >
                      Cancel request
                    </button>
                  )}
                </>
              )}
              {r.state >= 2 && r.state <= 4 && (
                <>
                  <p className="address">Selected provider: {r.provider}</p>
                  <p>
                    Selected reimbursement: {formatUnits(r.reimbursement, 18)}{" "}
                    CTC
                  </p>
                  <details>
                    <summary>Binding quote history ({r.quotes.length})</summary>
                    {r.quotes.map((q) => (
                      <p className="address" key={q.provider}>
                        {q.provider}: {formatUnits(q.amount, 18)} CTC
                      </p>
                    ))}
                  </details>
                </>
              )}
              {r.state === 2 && (
                <>
                  <div className="actions">
                    <button
                      disabled={
                        disabled ||
                        wallet.chain !== 11155111 ||
                        r.sourceOutcome !== 0 ||
                        wallet.address.toLowerCase() !==
                          r.provider.toLowerCase()
                      }
                      onClick={() => void action(() => execute(r))}
                    >
                      Repay on Sepolia
                    </button>
                    <button
                      disabled={
                        disabled ||
                        wallet.chain !== 11155111 ||
                        r.sourceOutcome !== 0 ||
                        Date.now() / 1000 <= r.executeBy
                      }
                      onClick={() => void action(() => execute(r, true))}
                    >
                      Record source expiry
                    </button>
                  </div>
                  <label htmlFor={`proof-${r.id}`}>
                    Source repayment or expiry transaction hash
                  </label>
                  <input
                    id={`proof-${r.id}`}
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x…"
                  />
                  <button
                    className="primary"
                    disabled={disabled || wallet.chain !== 102031}
                    onClick={() => void action(() => settle(r))}
                  >
                    Prove and settle
                  </button>
                  <p className="helper">
                    A late proof still pays the selected provider. Time passing
                    alone never refunds assigned escrow. An attestation outage
                    can keep funds locked.
                  </p>
                </>
              )}
              {mode === "request" && (
                <>
                  <details>
                    <summary>Immutable execution digest</summary>
                    <code className="address">{r.digest}</code>
                  </details>
                  <Mechanism request={r} />
                </>
              )}
            </article>
          ))}
        </>
      )}
      {config && wallet.address && (
        <div className="panel">
          <h2>Withdraw your credits</h2>
          <p>
            Withdraw confirmed reimbursement, cancellation credit or unused
            budget to your connected address.
          </p>
          <button
            disabled={disabled || wallet.chain !== 102031}
            onClick={() =>
              void action(() => send("withdraw", [wallet.address]))
            }
          >
            Withdraw credit
          </button>
        </div>
      )}
    </section>
  );
}
function message(e: unknown) {
  if (e && typeof e === "object" && "shortMessage" in e)
    return String(e.shortMessage);
  return e instanceof Error
    ? e.message
    : "Request failed. Retry after checking the network.";
}
