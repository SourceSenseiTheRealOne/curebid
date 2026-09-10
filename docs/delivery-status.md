# CureBid delivery status

## Verified implementation and public execution
- [x] Approved design/plan recovered; Ubuntu-only toolchain and canonical checkout retained.
- [x] 48 Foundry tests including real Aave supply/borrow/repayment and a regression reproducing live accrued-index rounding.
- [x] 16 TypeScript tests; strict types and formatting.
- [x] Immutable corrected contracts deployed to Sepolia/Creditcoin. Public manifests and constructor-bound transactions retained.
- [x] Request 1: two real quotes, provider selection, 3 USDC repayment, native-proof settlement, provider payout and surplus withdrawal.
- [x] Request 2: genuine source expiry, native-proof refund and borrower withdrawal.
- [x] Canonical escrow: zero reserved funds, zero credits, zero balance after withdrawals.
- [x] Four deployed eth_call negative proofs reject replay, provider substitution, request substitution and wrong chain key.
- [x] Deployment recovery resumed matching confirmed contracts after interruption; timed-out create was recovered from chain without duplication.
- [x] Required wallet routes, real RPC projections and published evidence inspector. Source/settlement statuses remain distinct.
- [x] 3D scene, themes, 320px layout, pause/reduced-motion/fallback and actual request browser checks (8 tests).
- [x] Production build and measured Lighthouse audit: performance 82, accessibility 100; LCP 0.9s, CLS 0.004, TBT 720ms. Lab results, not field INP.
- [x] Seven-slide evidence-backed deck and 44.48-second silent recorded UI walkthrough, explicitly labelled local UI/public testnets and not live signing.

## Remaining handoff items (not disguised as completed)
- [ ] Superseded trial escrow cleanup: its own original two-hour deadline must expire. Bounded `cleanup-superseded.ts` worker waits for proof-safe recovery; read `superseded-cleanup.json` before calling it complete.
- [ ] Team identity, organiser form and actual hackathon submission require user input/action.
- [x] Public frontend: https://curebid.vercel.app, deployed through the user’s Vercel account. Repository made public with explicit permission. Eight browser tests pass against the hosted production URL.
- [ ] Autonomous recovery of every arbitrary interrupted setup is not claimed: ambiguous pre-broadcast intents fail closed for operator inspection.

Current execution receipts, superseded-deployment history and exact proof boundaries are documented in `docs/evidence/execution-notes.md`. This is a testnet prototype, not an audited production financial service.
