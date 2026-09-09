import { Contract, JsonRpcProvider } from "ethers";
import marketAbi from "./CureMarket.json";
import routerAbi from "./CureRouter.json";
import {
  validateDeployment,
  type Deployment,
} from "../../../packages/protocol/src/deployment";
export { marketAbi, routerAbi };
export const SOURCE_RPC = "https://ethereum-sepolia-rpc.publicnode.com",
  DEST_RPC = "https://rpc.cc3-testnet.creditcoin.network";
export const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
export interface RequestView {
  id: string;
  borrower: string;
  amount: bigint;
  cap: bigint;
  quoteBy: number;
  executeBy: number;
  provider: string;
  reimbursement: bigint;
  digest: string;
  state: number;
  sourceOutcome: number;
  quotes: { provider: string; amount: bigint }[];
}
export async function deployment(): Promise<Deployment | null> {
  const r = await fetch("/deployment.json", { cache: "no-store" });
  if (!r.ok) throw new Error("Deployment configuration unavailable");
  const v: unknown = await r.json();
  return v === null ? null : validateDeployment(v);
}
export async function readRequests(
  d: Deployment,
  onlyId?: string,
): Promise<RequestView[]> {
  const rpc = new JsonRpcProvider(DEST_RPC),
    source = new JsonRpcProvider(SOURCE_RPC);
  try {
    if (
      (await rpc.getNetwork()).chainId !== 102031n ||
      (await source.getNetwork()).chainId !== 11155111n
    )
      throw new Error("Testnet network mismatch");
    const m = new Contract(d.market, marketAbi, rpc),
      router = new Contract(d.router, routerAbi, source);
    const next: bigint = await m.getFunction("nextId")();
    const ids = onlyId
      ? [BigInt(onlyId)]
      : Array.from(
          { length: Number(next > 51n ? 50n : next - 1n) },
          (_, i) => next - 1n - BigInt(i),
        );
    return await Promise.all(
      ids.map(async (id) => {
        const r = await m.getFunction("getRequest")(id);
        if (Number(r.state) === 0) throw new Error("Request not found");
        const providers: string[] = await m.getFunction("getProviders")(id);
        const quotes = await Promise.all(
          providers.map(async (provider) => ({
            provider,
            amount: (await m.getFunction("quotes")(id, provider)) as bigint,
          })),
        );
        return {
          id: String(id),
          borrower: r.borrower,
          amount: r.amount,
          cap: r.cap,
          quoteBy: Number(r.quoteBy),
          executeBy: Number(r.executeBy),
          provider: r.provider,
          reimbursement: r.reimbursement,
          digest: r.digest,
          state: Number(r.state),
          sourceOutcome:
            Number(r.state) >= 2 && Number(r.state) !== 5
              ? Number(await router.getFunction("outcome")(r.digest))
              : 0,
          quotes,
        };
      }),
    );
  } finally {
    rpc.destroy();
    source.destroy();
  }
}
export function phase(r: RequestView) {
  if (r.state === 3) return "Settlement confirmed";
  if (r.state === 4) return "Refund confirmed";
  if (r.state === 5) return "Cancelled";
  if (r.state === 1) return "Open for quotes";
  if (r.sourceOutcome === 1) return "Debt repaid · settlement pending";
  if (r.sourceOutcome === 2) return "Expiry confirmed · refund pending";
  return Date.now() / 1000 > r.executeBy
    ? "Awaiting expiry proof"
    : "Provider selected";
}
