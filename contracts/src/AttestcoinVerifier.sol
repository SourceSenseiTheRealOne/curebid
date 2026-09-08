// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {CureTerms} from "./CureTerms.sol";
import {CureProof,IOutcomeVerifier} from "./CureProof.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/INativeQueryVerifier.sol";
import {EvmV1Decoder as D} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
contract AttestcoinVerifier is IOutcomeVerifier {
    uint64 public immutable chainKey; address public immutable router; address public immutable pool; address public immutable asset;
    INativeQueryVerifier public constant PRECOMPILE=INativeQueryVerifier(address(0xFD2));
    bytes32 public constant REPAID=keccak256("DebtRepaid(bytes32,address,address,uint256,uint256)");
    bytes32 public constant EXPIRED=keccak256("ExecutionExpired(bytes32,address,address,uint256,uint256)");
    bytes32 public constant AAVE_REPAY=keccak256("Repay(address,address,address,uint256,bool)");
    constructor(uint64 key,address r,address p,address a) {
        require(block.chainid==102031 && key>0 && r!=address(0) && p!=address(0) && a!=address(0),"configuration");
        chainKey=key; router=r; pool=p; asset=a;
    }
    function verify(CureProof.Proof calldata p,CureTerms.Terms calldata t) external view returns(uint8 result,bytes32 replayKey) {
        require(p.chainKey==chainKey && t.sourceChain==11155111 && t.destinationChain==block.chainid,"chain domain");
        require(t.router==router && t.pool==pool && t.asset==asset && t.market!=address(0),"contract domain");
        require(t.borrower!=address(0) && t.provider!=address(0) && t.amount>0 && t.requestId>0,"terms");
        require(p.txBytes.length>=96 && p.txBytes.length<=65536 && p.merkle.siblings.length<=64 && p.continuity.roots.length<=256,"proof bounds");
        // This is the actual native verifier. No configurable bypass or administrative fallback.
        require(PRECOMPILE.verify(p.chainKey,p.height,p.txBytes,p.merkle,p.continuity),"native proof rejected");
        // Bounded MVP accepts EIP-1559 transactions only; the CLI explicitly sends type 2.
        D.DecodedTransactionType2 memory decoded=D.decodeTransactionType2(p.txBytes);
        require(decoded.type2.chainId==11155111 && decoded.receipt.receiptStatus==1,"source chain or receipt");
        D.LogEntry[] memory entries=decoded.receipt.receiptLogs;
        require(entries.length<=128,"log limit");
        bytes32 digest=CureTerms.hash(t); uint256 matching; uint256 selectedIndex; uint256 aaveMatches;
        for(uint256 i; i<entries.length; ++i) {
            D.LogEntry memory l=entries[i];
            if(l.address_==router && l.topics.length>1 && (l.topics[0]==REPAID || l.topics[0]==EXPIRED) && l.topics[1]==digest) {
                require(l.topics.length==4 && l.data.length==64,"outcome schema");
                require(l.topics[2]==bytes32(uint256(uint160(t.borrower))) && l.topics[3]==bytes32(uint256(uint160(t.provider))),"outcome parties");
                (uint256 amount,uint256 timestamp)=abi.decode(l.data,(uint256,uint256));
                require(amount==t.amount && timestamp>0,"outcome amount");
                result=l.topics[0]==REPAID?1:2;
                require(result==1?timestamp<=t.executeBy:timestamp>t.executeBy,"outcome deadline");
                matching++; selectedIndex=i;
            }
            if(l.address_==pool && l.topics.length==4 && l.topics[0]==AAVE_REPAY && l.topics[1]==bytes32(uint256(uint160(asset))) && l.topics[2]==bytes32(uint256(uint160(t.borrower))) && l.topics[3]==bytes32(uint256(uint160(router)))) {
                require(l.data.length==64,"Aave schema");
                (uint256 amount,bool useATokens)=abi.decode(l.data,(uint256,bool));
                if(amount==t.amount && !useATokens) aaveMatches++;
            }
        }
        require(matching==1,"missing or ambiguous outcome");
        require(result!=1 || aaveMatches==1,"missing or ambiguous Aave repayment");
        // Identity derives from proven bytes and authenticated log index, never caller-supplied txHash.
        replayKey=keccak256(abi.encode(chainKey,p.height,keccak256(p.txBytes),selectedIndex));
    }
}
