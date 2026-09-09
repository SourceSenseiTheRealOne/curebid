# Integration and security model

`CureRouter` is immutable and checks source chain 11155111, approved Aave Pool/token/debt token, provider, amount and deadline. It checks exact Aave returned amount and actual debt reduction with one base-unit scaled-debt rounding tolerance. This does not allow underpayment. It clears Pool allowance and records either Repaid or Expired, never both.

`CureMarket` runs only on 102031, escrows native CTC, bounds provider count at 32 and separates reserved funds from pull credits. Quote acceptance binds the expected price. Unused cap becomes borrower credit. An assigned request has no timer-only refund or administrator withdrawal.

`AttestcoinVerifier` calls native `0xFD2` in the settlement call, decodes the pinned ASC EVM type-2 format, requires successful receipt and Sepolia chain, then authenticates router and Aave emitters and exact business fields. Foreign decoys are ignored; ambiguous outcomes are rejected. Replay identity derives from proven bytes and matched log index rather than an untrusted supplied hash. Type-2 source transactions are an intentional MVP restriction. SDK: 0.18.0; ASC contracts: 0.2.1.

Attestcoin chain key is not an EVM chain ID. Live discovery returned chain key 1 for Sepolia and EVM encoding 1. CLI deployment rediscovers it; contracts enforce it. UI proof transport uses the supported MVP key and cannot override the verifier.

The proof endpoint is an untrusted, unsigned courier. It accepts a source hash, returns service proof, and never loads a signer. Native verification and business rules remain authoritative even if the endpoint is compromised. Public hosting should add perimeter rate limiting before general internet exposure. The browser only requests an injected wallet signature on the correct network and never accepts private keys.

## Trust and liveness

Trust includes the source Aave deployment, Creditcoin/Attestcoin consensus and attestation, immutable deployment configuration, wallet integrity and chain RPC integrity for user decision-making. No production audit has been performed. Correct contracts do not guarantee provider availability or proof liveness. A prolonged proof outage can keep assigned escrow locked; an administrator cannot invent a refund to conceal this.

## Evidence classes

- Unit/fuzz fixtures: adversarial receipt logs, proof rejection, state machines and accounting.
- Real protocol fork: pinned Sepolia block 11660009, real faucet/Pool/debt contracts, local actor impersonation; not public transactions.
- Historical proof: public third-party transaction, generated proof and actual native precompile read-only verification; not CureBid execution.
- Public owned deployment/repayment/settlement/refund: still funding-blocked.

Do not conflate these evidence classes in the deck, README or video.
