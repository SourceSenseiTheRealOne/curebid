# CureBid context

Approved project: market for actual third-party Aave USDC debt repayment on Sepolia, reimbursed from native CTC escrow on Creditcoin testnet after Attestcoin verification. Two providers compete with fixed total CTC quotes. Proof-gated source expiry prevents refunds stealing an honest provider's earned reimbursement.

UI: original cinematic chrome-and-mint 3D repayment mechanism, state-aware, with accessible flat wallet/amount/quote controls and progressive fallbacks.

The user explicitly approved the entire written design, minimal stack, fresh isolated testnet wallets and complete implementation. Do not repeatedly ask for architecture approval. External paid/mainnet/publishing actions remain excluded.

Canonical approved design: parent Lab `../../docs/superpowers/specs/2026-09-07-curebid-design.md`.
Execution plan: parent Lab `../../docs/superpowers/plans/2026-09-07-curebid-implementation.md`.
Research: parent Lab `../../docs/research/curebid-feasibility-2026-09-07.md`.

Authority: contracts, not workers/UI. No database/Clerk/Go for this bounded project. Source test USDC is not production money; CTC quote is not a dollar fee. Existing secret files and other projects are off limits.

Historical receipt feasibility is verified: `docs/evidence/historical-proof.json` records a third-party Aave repayment authenticated by the actual Creditcoin precompile. This is NOT CureBid-owned execution. ChainInfo maps Sepolia to chain key 1, encoding 1. The real Aave fork passes using faucet LINK collateral; USDC/DAI supplies exceed their configured caps. Canonical public deployment and both owned two-chain outcomes are verified: request 1 settled and provider paid; request 2 refunded and borrower paid. Canonical escrow is empty. The first router was superseded after a real accrued-index rounding failure; corrected regression and manifests are retained. Legacy trial cleanup waits for its original deadline. Current delivery details and unresolved acceptance criteria are in `docs/delivery-status.md`; execution is documented in `docs/testnet-runbook.md`. Current user authorization includes commit/push to main, but not fabricated live success or mainnet.
