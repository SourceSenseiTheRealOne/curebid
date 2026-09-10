"use client";
import { useEffect, useState } from "react";
interface Evidence {
  checkedAt: string;
  provenance: string;
  requests: {
    id: string;
    state: number;
    sourceOutcome: number;
    sourceTransactions: { hash: string }[];
    settlementTransactions: string[];
  }[];
}
export function LiveEvidence() {
  const [data, setData] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void fetch("/evidence.json", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Recorded evidence not available");
        const v = (await r.json()) as Evidence;
        if (!Array.isArray(v.requests))
          throw new Error("Invalid evidence record");
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(String(e.message));
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="panel">
      <h2>Recorded public execution</h2>
      <p>
        This is a published receipt snapshot, not a live verification result.
        Refresh the marketplace for current chain state.
      </p>
      {error && <p role="status">{error}</p>}
      {data && (
        <>
          <p>
            {data.provenance}
            <br />
            Captured {data.checkedAt}
          </p>
          {data.requests.map((r) => (
            <div key={r.id}>
              <h3>
                <a href={`/requests/${r.id}`}>Request #{r.id}</a>:{" "}
                {r.state === 3
                  ? "Settlement confirmed"
                  : r.state === 4
                    ? "Refund confirmed"
                    : "Not yet settled"}
              </h3>
              {r.sourceTransactions.map((t) => (
                <p className="address" key={t.hash}>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${t.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source receipt: {t.hash} ↗
                  </a>
                </p>
              ))}
              {r.settlementTransactions.map((hash) => (
                <p className="address" key={hash}>
                  <a
                    href={`https://creditcoin-testnet.blockscout.com/tx/${hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Creditcoin settlement: {hash} ↗
                  </a>
                </p>
              ))}
            </div>
          ))}
        </>
      )}
      <a href="/evidence.json">Download the public evidence JSON ↗</a>
    </section>
  );
}
