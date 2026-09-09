# CureBid

**Your debt. Their liquidity.** Competing providers repay an existing Aave USDC debt on Ethereum Sepolia. The borrower keeps their collateral and reimburses the selected provider in native testnet CTC only after Attestcoin verifies the request-bound outcome.

## Delivery status

Implemented contracts, wallet UI, read-only proof tooling and explicit testnet execution commands. **Not yet deployed; not submission-ready.** Fresh project wallets require testnet funding. No CureBid-owned public repayment, settlement or expiry-refund is claimed. `docs/evidence/historical-proof.json` is a separately labelled third-party Aave receipt verified by the real Creditcoin precompile.

Verified locally: 47 Foundry tests (including actual Aave supply/borrow/third-party repayment on a pinned Sepolia fork), 16 TypeScript tests, 7 browser tests, strict types, formatting and Next production build. Tests simulate cryptographic outcomes only inside contract test fixtures. Production verification cannot select a simulated verifier.

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
bash scripts/wsl-run.sh pnpm doctor
bash scripts/wsl-run.sh pnpm verify:repayment 0xd85c88297918c95fdea5816a4843f2f556d902af722a49ed4c89cc189c2d29b0
bash scripts/wsl-run.sh pnpm judge:verify
```

The last command intentionally fails until `deployments/testnet.json` exists. A successful deployment check verifies configuration, code presence, solvency and bounded request readbacks; it does not by itself certify every submission criterion.

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

[Integration/security](docs/integration-security.md) · [Delivery checklist](docs/delivery-status.md) · [Provenance](docs/provenance.md) · [Draft deck](docs/submission/curebid-deck.pdf)
