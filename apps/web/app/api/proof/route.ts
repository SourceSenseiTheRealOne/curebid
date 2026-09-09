import { NextResponse } from "next/server";
import { proofProvider } from "@gluwa/usc-sdk";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 200)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const { hash } = JSON.parse(raw) as { hash: unknown };
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash))
      return NextResponse.json(
        { error: "Invalid source transaction hash" },
        { status: 400 },
      );
    const result = await new proofProvider.service.ProofBuilder(
      1,
      "https://prover.cc3-testnet.creditcoin.network",
    ).getProof(hash);
    if (!result.success || !result.data)
      return NextResponse.json(
        {
          error:
            "Proof not available. Source transaction may be awaiting attestation; retry later.",
        },
        { status: 503 },
      );
    const p = result.data;
    if (p.chainKey !== 1) throw new Error("Source proof chain mismatch");
    return NextResponse.json({
      proof: {
        chainKey: p.chainKey,
        height: p.headerNumber,
        txBytes: p.txBytes,
        merkle: p.merkleProof,
        continuity: p.continuityProof,
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Proof service unavailable or invalid response. No settlement was submitted.",
      },
      { status: 503 },
    );
  }
}
