// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/INativeQueryVerifier.sol";
import {CureTerms} from "./CureTerms.sol";
library CureProof {
    struct Proof { uint64 chainKey; uint64 height; bytes txBytes; INativeQueryVerifier.MerkleProof merkle; INativeQueryVerifier.ContinuityProof continuity; }
}
interface IOutcomeVerifier {
    function verify(CureProof.Proof calldata proof,CureTerms.Terms calldata terms) external view returns(uint8 outcome,bytes32 replayKey);
}
