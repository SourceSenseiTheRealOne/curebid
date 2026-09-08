// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
library CureTerms {
    bytes32 internal constant VERSION = keccak256("CureBid.v1");
    struct Terms {
        uint256 destinationChain; address market; uint256 requestId;
        uint256 sourceChain; address router; address pool; address asset;
        address borrower; address provider; uint256 amount; uint256 executeBy;
    }
    function hash(Terms memory terms) internal pure returns (bytes32) { return keccak256(abi.encode(VERSION, terms)); }
}
