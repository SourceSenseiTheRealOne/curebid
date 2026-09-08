# CureBid context

Approved project: market for actual third-party Aave USDC debt repayment on Sepolia, reimbursed from native CTC escrow on Creditcoin testnet after Attestcoin verification. Two providers compete with fixed total CTC quotes. Proof-gated source expiry prevents refunds stealing an honest provider's earned reimbursement.

UI: original cinematic chrome-and-mint 3D repayment mechanism, state-aware, with accessible flat wallet/amount/quote controls and progressive fallbacks.

The user explicitly approved the entire written design, minimal stack, fresh isolated testnet wallets and complete implementation. Do not repeatedly ask for architecture approval. External paid/mainnet/publishing actions remain excluded.

Canonical approved design: parent Lab `../../docs/superpowers/specs/2026-09-07-curebid-design.md`.
Execution plan: parent Lab `../../docs/superpowers/plans/2026-09-07-curebid-implementation.md`.
Research: parent Lab `../../docs/research/curebid-feasibility-2026-09-07.md`.

Authority: contracts, not workers/UI. No database/Clerk/Go for this bounded project. Source test USDC is not production money; CTC quote is not a dollar fee. Existing secret files and other projects are off limits.

Live feasibility is not yet proven. Both RPC IDs and real Aave code/token decimals were read. Proof service `https://prover.cc3-testnet.creditcoin.network` returned healthy; the environment-page alternate had degraded upstream health. Chain key discovery and actual proof verification must precede marketplace UI claims.
