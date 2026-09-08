# CureBid agent rules

Read `context/capsule.md` and `context/stack.md` before edits. Approved design/plan are initially in the parent Lab at `../../docs/superpowers/specs/2026-09-07-curebid-design.md` and `../../docs/superpowers/plans/2026-09-07-curebid-implementation.md`.

- One canonical checkout, one writer, no worktrees/duplicate repositories. Preserve unrelated work. No commits/push/publishing unless explicitly asked.
- Testnet-only. Allowed network IDs: Ethereum Sepolia 11155111, Creditcoin CC3 102031. Attestcoin chainKey must be discovered independently. Never touch mainnet or existing wallets/secrets.
- User approved fresh isolated testnet wallets and free faucet-funded deployment/Aave repayment/settlement. Keys remain in protected ignored local state, never logs/source/chat. No CAPTCHA/auth bypass or paid services.
- Behavioral code uses strict RED -> GREEN -> REFACTOR with real focused test output. Test doubles stay under tests and cannot be selected by deployment/runtime configuration. No mock balances, fake orders, fabricated proofs or invented execution claims.
- Source router Repaid/Expired outcomes are mutually exclusive. Creditcoin assigned escrow only pays/refunds from real authenticated Attestcoin outcome proof; timeout alone cannot erase a repayment claim.
- Distinguish Aave actual debt reduction from requested repayment and token transfers. Require receipt success, authentic router and Pool logs, full request/domain/party/amount/time binding and replay protection.
- Native CTC reimbursement is not USD. No fabricated price conversion or fake bridged tokens.
- Blockchain tools run in WSL Ubuntu-24.04. Coordinator bootstraps verified tools under `$HOME/.local/share/curebid/toolchains/`. Do not read or modify global agent configuration.
- CodeGraph status/init/sync before investigation and affected after source changes. Keep its state ignored. Windows CodeGraph may be used over this canonical checkout.
- Financial UI controls remain accessible flat HTML. Original Three.js chrome/mint debt/escrow mechanism is required, state-driven, lazily loaded and disposable; reduced-motion/pause/no-WebGL/mobile fallbacks required. No simulated successful settlement on real routes.
- Pin direct dependencies and lockfile. Current registry probes: Next 16.3.4, USC SDK 0.18.0, ASC contracts 0.2.1; recheck dependency compatibility before use. Attribute official/open-source components; no CipherBid or competitor product code reuse.
- Verify actual tests/types/lint/build, Foundry, browser desktop/mobile and real network readbacks. A funded/testnet blocker is not permission to invent success. No overall done claim while any acceptance requirement is unverified.
