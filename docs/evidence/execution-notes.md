# Public execution and rounding correction

## Canonical deployment

- Sepolia CureRouter: `0xD0007a77bdeEc0A554b2A55E13A542c684Df73E9`
- Creditcoin CureMarket: `0xD0007a77bdeEc0A554b2A55E13A542c684Df73E9`
- Creditcoin AttestcoinVerifier: `0x682E804C025342AD83143DFc097836ee396eFE8C`

Identical router/market address strings refer to **different networks**. The manifest binds each chain explicitly. `deployments/transactions.json` contains constructor-bound receipts; `pnpm judge:verify` reads all immutable identities and accounting back from the actual chains.

## Request 1: repayment and reimbursement

- Funded request: `0x144f8eba30ffb7de105447d165c6f04d3d480ee1209abe625f5277712cc2ca98` (Creditcoin). The RPC timed out after broadcast; on-chain recovery confirmed request ID 1, so no duplicate request was created.
- Provider A quote: `0x1941e247cec106f67148ff166212f2d0c1b3f97e503a34a44ed73840341dfa46` (0.07 CTC).
- Provider B quote: `0xd56c65de172f71525dd94e9f9b1c1da393cbfe74a866ae5ff833ae60659a7173` (0.09 CTC).
- Selection: `0xdf4771473e63509dc8c01745f498fe257db2d4c13b1cdb9a88a8ac2f184de8a9`.
- Actual 3 USDC repayment: https://sepolia.etherscan.io/tx/0x7852c72318a698309a08a2a20277005fe899eb3f099ffeb7c0f5e1ea529a7620
- Native-proof-backed settlement: https://creditcoin-testnet.blockscout.com/tx/0xcf4d7adb835fa0f7eda3823d81798790d4ba9bd0c73c5e91ce9eaf23d0b3d84e
- Provider withdrawal: `0x2bcd9aa18add797fef708d26af6e8c44794de9bf28c05fc4f1e23714d883f0b8`.
- Borrower surplus withdrawal (requests 1 and 2): `0x7dbc568b3746ea5006b3288973b4d4d35937dd04b186337ef7f5f8d1acfd4024`.

`live-negative-proofs.json` records actual deployed-contract eth_call rejection of replay, provider substitution, request substitution and wrong source chain key using the owned real native proof. These are read-only adversarial probes, not broadcast attack transactions.

## Request 2: separate source expiry

Source non-execution expiry: https://sepolia.etherscan.io/tx/0xbf6a32a7db3aa97134b071082b85cf3410be6a0be288ac66d6c97a52eaafca7e

See `live-execution.json` for the verified destination status. Source expiry alone is not a refund.

## Superseded trial

The original deployment is preserved under `deployments/superseded-fixed-rounding/`. Its repayment transaction `0x718a8c0e6c1b409fb820a2a878aee1f7c78c2f5b523bb41f16fcc54129b0d78d` reverted atomically with `debt accounting`.

The real Aave index was approximately 3.41 RAY. Aave returned exactly 3,000,000 base units repaid, while the two debt balance reads differed by 3,000,002. A fixed one-unit tolerance was not valid at this accrued index. The regression pins source block 11674990 and reproduces that exact two-unit change. The corrected router bounds rayDiv/rayMul rounding by `ceil(index / (2*RAY)) + 1`, while still requiring exact Aave repayment and positive debt reduction. No underpayment rule was weakened, no live contract was patched, and no failed receipt was reclassified as successful.

The old trial has its own two-hour expiry deadline, independent of canonical requests. `scripts/cleanup-superseded.ts --testnet` waits for genuine source expiry, obtains its native proof, refunds and withdraws only the original borrower credit. It never touches the canonical manifest. Until `superseded-cleanup.json` exists and verifies cleared accounting, that cleanup remains pending.
