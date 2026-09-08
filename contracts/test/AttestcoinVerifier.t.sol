// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Vm} from "./CureRouter.t.sol";
import {CureTerms} from "../src/CureTerms.sol";
import {CureProof} from "../src/CureProof.sol";
import {AttestcoinVerifier} from "../src/AttestcoinVerifier.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/INativeQueryVerifier.sol";
import {EvmV1Decoder as D} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
// Synthetic proof acceptance exists ONLY in this isolated test directory.
contract FixturePrecompile is INativeQueryVerifier {
    bool public reject;
    function setReject(bool value) external { reject=value; }
    function verify(uint64,uint64,bytes calldata,MerkleProof calldata,ContinuityProof calldata) external view returns(bool) { return !reject; }
}
contract AttestcoinVerifierTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PRECOMPILE=address(0xFD2);
    address constant ROUTER=address(0xAA); address constant POOL=address(0xBB); address constant ASSET=address(0xCC);
    CureTerms.Terms t; AttestcoinVerifier adapter;
    function setUp() public {
        vm.chainId(102031); vm.warp(1000);
        vm.etch(PRECOMPILE,address(new FixturePrecompile()).code);
        adapter=new AttestcoinVerifier(1,ROUTER,POOL,ASSET);
        t=CureTerms.Terms(102031,address(this),1,11155111,ROUTER,POOL,ASSET,address(0xB0),address(0xA1),300e6,2000);
    }
    function topic(address a) internal pure returns(bytes32) { return bytes32(uint256(uint160(a))); }
    function logs(bool expired) internal view returns(D.LogEntry[] memory l) {
        l=new D.LogEntry[](3);
        bytes32[] memory out=new bytes32[](4); out[0]=keccak256(bytes(expired?"ExecutionExpired(bytes32,address,address,uint256,uint256)":"DebtRepaid(bytes32,address,address,uint256,uint256)")); out[1]=CureTerms.hash(t); out[2]=topic(t.borrower); out[3]=topic(t.provider);
        l[0]=D.LogEntry(address(0xDECA),out,abi.encode(t.amount,uint256(expired?2001:1900)));
        l[1]=D.LogEntry(ROUTER,out,abi.encode(t.amount,uint256(expired?2001:1900)));
        bytes32[] memory aave=new bytes32[](4); aave[0]=keccak256("Repay(address,address,address,uint256,bool)"); aave[1]=topic(ASSET); aave[2]=topic(t.borrower); aave[3]=topic(ROUTER);
        l[2]=D.LogEntry(POOL,aave,abi.encode(t.amount,false));
    }
    function encoded(D.LogEntry[] memory l,uint8 status,uint64 sourceId) internal pure returns(bytes memory) {
        bytes[] memory chunks=new bytes[](3);
        chunks[0]=abi.encode(uint64(1),uint64(500000),address(0xA1),false,ROUTER,uint256(0),bytes(""));
        D.AccessListEntry[] memory access=new D.AccessListEntry[](0);
        chunks[1]=abi.encode(sourceId,uint128(1),uint128(1),access,uint8(0),bytes32(uint256(1)),bytes32(uint256(1)));
        chunks[2]=abi.encode(status,uint64(100000),l,new bytes(256));
        return abi.encode(uint8(2),chunks);
    }
    function proof(D.LogEntry[] memory l) internal pure returns(CureProof.Proof memory p) { p.chainKey=1; p.height=123; p.txBytes=encoded(l,1,11155111); }
    function testValidOutcomeAfterForeignDecoy() public view { (uint8 result,bytes32 key)=adapter.verify(proof(logs(false)),t); require(result==1 && key!=bytes32(0)); }
    function testValidExpiry() public view { (uint8 result,)=adapter.verify(proof(logs(true)),t); require(result==2); }
    function testNativeProofRejection() public { FixturePrecompile(PRECOMPILE).setReject(true); vm.expectRevert(); adapter.verify(proof(logs(false)),t); }
    function testWrongBorrowerLog() public { D.LogEntry[] memory l=logs(false); l[1].topics[2]=topic(address(0xBAD)); vm.expectRevert(); adapter.verify(proof(l),t); }
    function testWrongProviderLog() public { D.LogEntry[] memory l=logs(false); l[1].topics[3]=topic(address(0xBAD)); vm.expectRevert(); adapter.verify(proof(l),t); }
    function testPartialAmountLog() public { D.LogEntry[] memory l=logs(false); l[1].data=abi.encode(t.amount-1,uint256(1900)); vm.expectRevert(); adapter.verify(proof(l),t); }
    function testRevertedReceiptCannotPay() public { CureProof.Proof memory p=proof(logs(false)); p.txBytes=encoded(logs(false),0,11155111); vm.expectRevert(); adapter.verify(p,t); }
    function testWrongDecodedChain() public { CureProof.Proof memory p=proof(logs(false)); p.txBytes=encoded(logs(false),1,1); vm.expectRevert(); adapter.verify(p,t); }
    function testWrongChainKey() public { CureProof.Proof memory p=proof(logs(false)); p.chainKey=2; vm.expectRevert(); adapter.verify(p,t); }
    function testWrongRouterEmitter() public { D.LogEntry[] memory l=logs(false); l[1].address_=POOL; vm.expectRevert(); adapter.verify(proof(l),t); }
    function testWrongPoolEmitter() public { D.LogEntry[] memory l=logs(false); l[2].address_=ROUTER; vm.expectRevert(); adapter.verify(proof(l),t); }
    function testAmbiguousOutcomes() public { D.LogEntry[] memory l=logs(false); l[0].address_=ROUTER; vm.expectRevert(); adapter.verify(proof(l),t); }
    function testStaleExecution() public { D.LogEntry[] memory l=logs(false); l[1].data=abi.encode(t.amount,uint256(2001)); vm.expectRevert(); adapter.verify(proof(l),t); }
    function testEarlyExpiry() public { D.LogEntry[] memory l=logs(true); l[1].data=abi.encode(t.amount,uint256(2000)); vm.expectRevert(); adapter.verify(proof(l),t); }
    function testNoncanonicalAddressTopic() public { D.LogEntry[] memory l=logs(false); l[1].topics[2]=bytes32(uint256(l[1].topics[2]) | (uint256(1)<<255)); vm.expectRevert(); adapter.verify(proof(l),t); }
    function testTrailingEventBytes() public { D.LogEntry[] memory l=logs(false); l[1].data=abi.encode(t.amount,uint256(1900),uint256(0)); vm.expectRevert(); adapter.verify(proof(l),t); }
    function testWrongDestinationDomain() public { CureProof.Proof memory p=proof(logs(false)); t.destinationChain=1; vm.expectRevert(); adapter.verify(p,t); }
    function testMalformedBytes() public { CureProof.Proof memory p=proof(logs(false)); p.txBytes=hex"abcd"; vm.expectRevert(); adapter.verify(p,t); }
}
