# Testnet execution runbook

Only `Ubuntu` WSL; fresh project custody is `/home/sourcesensei/.local/share/curebid/keys/` with private file mode 0600 and directory 0700. This file contains no private keys. Do not migrate old wallets implicitly.

## Funding

| Role | Address | Required test assets |
|---|---|---|
| Borrower/deployer | `0x2E7b9fbd8b9a1652A310f58b4854682Ff045E656` | Sepolia ETH and CC3 testnet CTC |
| Provider A | `0x30f50d7222e544FF5849987Fd33bd9A7569C7CCe` | Sepolia ETH and CC3 testnet CTC |
| Provider B | `0xbcB91e4fEE4B9cF74f780154B1a8176C42A88Af8` | CC3 testnet CTC |

Official Creditcoin faucet: https://docs.creditcoin.org/wallets/using-testnet-faucet — join the linked Discord, use `/faucet address:<EVM-address>` in `token-faucet`. Account/CAPTCHA gates must be completed by the user. Never fund with real tokens.

Commands below run through `bash scripts/wsl-run.sh` or with its toolchain directory on PATH. Check `pnpm funding:status` first.

```sh
forge build
pnpm abi:export
pnpm deploy:testnet
pnpm judge:verify
pnpm testnet setup --testnet
pnpm testnet create --testnet
# Use the actual emitted request ID, not a guessed nextId.
pnpm testnet quote-a --testnet REQUEST_ID
pnpm testnet quote-b --testnet REQUEST_ID
pnpm testnet accept --testnet REQUEST_ID
pnpm testnet repay --testnet REQUEST_ID
# Use the actual source repayment hash printed by repay.
pnpm testnet settle --testnet REQUEST_ID SOURCE_TX_HASH
pnpm testnet withdraw --testnet
pnpm judge:verify
```

The CLI demo requests 3 test USDC, caps reimbursement at 0.1 test CTC, and submits 0.07/0.09 CTC quotes. These are requested transaction inputs, NOT existing on-chain orders. Setup borrows 10 test USDC against 1,000 faucet LINK. Source liquidity is limited and must be rechecked before setup. The underlying test USDC reserve is above its supply cap, so supplying USDC as collateral is not a viable setup path; LINK was verified on the real fork instead.

## Expiry/refund

Use `pnpm testnet create-expiry --testnet` for a separate 10-minute execution window (3-minute quote window), submit a quote and accept it promptly, but do not repay it. After its source execution deadline, run `pnpm testnet expire --testnet REQUEST_ID`, then settle using the emitted expiry transaction hash and withdraw borrower credit. Waiting alone never refunds assigned escrow. Do not change chain time or synthesize proof in a public demonstration.

## Recovery

`repay` reads the router outcome and will not repay a terminal digest twice. `settle` checks destination state and can be rerun after proof availability; a pending proof is an error, not a success. Settlement credits are withdrawn separately. Confirmation journals are public under `docs/evidence/transactions/`.

Deployment persists pre-broadcast intent and transaction identity. Confirmed matching deployments resume from actual receipt/code readback. An interrupted intent without a recorded hash fails closed and requires inspection of `deployments/transactions.json` and source/destination nonces before retry. Setup refuses a borrower with existing debt; after a partial setup, inspect actual balances and approvals before running more setup operations. The CLI is a bounded operator workflow, not an autonomous durable transaction scheduler. Do not run multiple writers/signers concurrently.

Canonical deployment and both live outcomes are now recorded in `deployments/testnet.json` and `docs/evidence/live-execution.json`. Rebuild/restart the UI after changing its public manifest. Do not rerun setup/create just to inspect existing results.
