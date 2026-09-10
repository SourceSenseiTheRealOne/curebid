# CureBid

**Your debt. Their liquidity.** Competing providers repay an existing Aave USDC debt on Ethereum Sepolia. The borrower keeps their collateral and reimburses the selected provider in native testnet CTC only after Attestcoin verifies the request-bound outcome.

## Delivery status

**Deployed and exercised on public testnets.** Request 1 repaid 3 USDC through Aave and reimbursed/paid out 0.07 CTC through native Attestcoin proof. Request 2 proved source expiry, refunded the borrower and paid out the refund. Canonical escrow readback: zero reserved funds, zero outstanding credits and zero balance. See [actual execution evidence](docs/evidence/execution-notes.md) and [44-second recorded UI walkthrough](docs/submission/curebid-walkthrough.mp4). The testnet UI is publicly hosted at **https://curebid.vercel.app** on Vercel, with GitHub deployment integration. Team/submission details remain user-supplied; superseded trial cleanup is tracked separately.

Verified locally: 48 Foundry tests (including actual Aave supply/borrow/third-party repayment on a pinned Sepolia fork), 16 TypeScript tests, 8 browser tests, strict types, formatting and Next production build. Tests simulate cryptographic outcomes only inside contract test fixtures. Production verification cannot select a simulated verifier.

## Run

Use the canonical checkout, WSL distro **Ubuntu**, and its Linux dependencies.

```sh
bash scripts/bootstrap-toolchain.sh
bash scripts/wsl-run.sh pnpm install --frozen-lockfile
bash scripts/wsl-run.sh pnpm test
bash scripts/wsl-run.sh forge test
bash scripts/wsl-run.sh pnpm typecheck
bash scripts/wsl-run.sh pnpm lint
bash scripts/wsl-run.sh pnpm build
bash scripts/wsl-run.sh pnpm start
```

Open http://localhost:4310. Routes: `/`, `/repay`, `/providers`, `/requests/[id]`, `/verify`. `/requests/new` redirects to `/repay`.

Browser checks, with the production server running:

```sh
bash scripts/wsl-run.sh pnpm exec playwright install --with-deps chromium
bash scripts/wsl-run.sh pnpm test:browser
```

## Verify without keys

```sh
bash scripts/wsl-run.sh pnpm run doctor
bash scripts/wsl-run.sh pnpm verify:repayment 0xd85c88297918c95fdea5816a4843f2f556d902af722a49ed4c89cc189c2d29b0
bash scripts/wsl-run.sh pnpm judge:verify
```

The verifier checks the committed public manifest, actual code presence, immutable configuration, solvency and request states. It fails on an absent/mismatched deployment. `scripts/live-negative-proofs.ts` separately proves rejection of replay, provider/request substitution and wrong chain key using an actual owned native proof.

## Testnet-only execution

See [the runbook](docs/testnet-runbook.md). Never send real funds. Never paste keys into the browser or commit them. Existing user wallets are out of scope.

## Why this instead of a generic proof-payment demo?

- Providers compete for a fixed **debt-reduction obligation**, not merely a token transfer.
- Source execution checks actual Aave repayment and debt accounting.
- The full request, escrow, chain, provider, borrower, asset, amount and deadline are committed in the execution digest.
- Source repayment and expiry are mutually exclusive. An assigned request cannot refund just because a proof is late; only an authenticated source expiry can refund it.
- Anyone can deliver the proof, but cannot redirect the beneficiary.

## Boundaries

Not a bridge, lending pool, credit score, automatic liquidation rescue, audited protocol or production financial service. The same EOA owns the request and source debt. The same provider EOA spends on source and earns on destination. CTC quotes are total reimbursements, not dollar fees. Attestation outages may lock assigned escrow. Providers bear inventory, gas, FX and proof-latency risk.

[Integration/security](docs/integration-security.md) · [Delivery checklist](docs/delivery-status.md) · [Provenance](docs/provenance.md) · [Deck](docs/submission/curebid-deck.pdf)
