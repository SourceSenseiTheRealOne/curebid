// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Vm} from "./CureRouter.t.sol";
import {CureMarket} from "../src/CureMarket.sol";
import {CureTerms} from "../src/CureTerms.sol";
import {CureProof,IOutcomeVerifier} from "../src/CureProof.sol";
contract FixtureVerifier is IOutcomeVerifier {
    uint8 public value=1;
    function set(uint8 v) external { value=v; }
    function verify(CureProof.Proof calldata,CureTerms.Terms calldata t) external view returns(uint8,bytes32) { return(value,CureTerms.hash(t)); }
}
contract RejectNative { receive() external payable { revert("no"); } }
contract CureMarketTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    CureMarket market; FixtureVerifier verifier;
    address borrower=address(0xB0); address p1=address(0xA1); address p2=address(0xA2);
    function setUp() public { vm.chainId(102031); vm.warp(1000); vm.deal(borrower,100 ether); verifier=new FixtureVerifier(); market=new CureMarket(address(0xAA),address(0xBB),address(0xCC),verifier); }
    function create() internal returns(uint256) { vm.prank(borrower); return market.createRequest{value:3 ether}(300e6,1400,2000); }
    function assign() internal returns(uint256 id) { id=create(); vm.prank(p1); market.submitQuote(id,2 ether); vm.prank(p2); market.submitQuote(id,2.5 ether); vm.prank(borrower); market.acceptQuote(id,p1,2 ether); }
    function proof() internal pure returns(CureProof.Proof memory p) { return p; }
    function conserved() internal view { require(address(market).balance>=market.reserved()+market.totalCredits(),"insolvent"); }
    function testTwoQuotesAndSelection() public {
        uint256 id=assign(); CureMarket.Request memory r=market.getRequest(id);
        require(r.provider==p1 && r.reimbursement==2 ether && r.state==CureMarket.State.Assigned);
        require(market.getProviders(id).length==2 && market.credits(borrower)==1 ether && market.reserved()==2 ether);
        require(r.digest==CureTerms.hash(market.getTerms(id))); conserved();
    }
    function testPermissionlessSettlementCannotRedirectPayee() public {
        uint256 id=assign(); vm.prank(p2); market.settle(id,proof());
        require(market.credits(p1)==2 ether && market.credits(p2)==0);
        require(market.getRequest(id).state==CureMarket.State.Settled); conserved();
    }
    function testReplayFails() public { uint256 id=assign(); market.settle(id,proof()); vm.expectRevert(); market.settle(id,proof()); }
    function testProofExpiryRefundsBorrowerOnly() public { uint256 id=assign(); verifier.set(2); market.settle(id,proof()); require(market.credits(borrower)==3 ether && market.credits(p1)==0); require(market.getRequest(id).state==CureMarket.State.Refunded); conserved(); }
    function testTimerAloneCannotRefundAssigned() public { uint256 id=assign(); vm.warp(100000); vm.prank(borrower); vm.expectRevert(); market.cancelRequest(id); require(market.getRequest(id).state==CureMarket.State.Assigned); }
    function testLateValidProofStillPays() public { uint256 id=assign(); vm.warp(100000); market.settle(id,proof()); require(market.credits(p1)==2 ether); }
    function testOpenCancelThenWithdraw() public { uint256 id=create(); vm.prank(borrower); market.cancelRequest(id); vm.prank(borrower); market.withdraw(payable(borrower)); require(borrower.balance==100 ether && market.credits(borrower)==0); conserved(); }
    function testRejectedWithdrawalKeepsCredit() public { uint256 id=create(); vm.prank(borrower); market.cancelRequest(id); RejectNative reject=new RejectNative(); vm.prank(borrower); vm.expectRevert(); market.withdraw(payable(address(reject))); require(market.credits(borrower)==3 ether); conserved(); }
    function testExpectedQuoteStopsPriceChangeRace() public { uint256 id=create(); vm.prank(p1); market.submitQuote(id,1 ether); vm.prank(p1); market.submitQuote(id,2 ether); vm.prank(borrower); vm.expectRevert(); market.acceptQuote(id,p1,1 ether); }
    function testAboveCapQuote() public { uint256 id=create(); vm.prank(p1); vm.expectRevert(); market.submitQuote(id,4 ether); }
    function testOnlyBorrowerAccepts() public { uint256 id=create(); vm.prank(p1); market.submitQuote(id,1 ether); vm.prank(p2); vm.expectRevert(); market.acceptQuote(id,p1,1 ether); }
    function testSelectedQuoteCannotChange() public { uint256 id=assign(); vm.prank(p1); vm.expectRevert(); market.submitQuote(id,1 ether); }
    function testUnknownOutcomeCannotPay() public { uint256 id=assign(); verifier.set(0); vm.expectRevert(); market.settle(id,proof()); require(market.reserved()==2 ether); }
    function testFuzzConservation(uint96 value) public { uint256 cap=uint256(value)+2; vm.deal(borrower,cap); vm.prank(borrower); uint256 id=market.createRequest{value:cap}(1,1400,2000); vm.prank(p1); market.submitQuote(id,cap-1); vm.prank(borrower); market.acceptQuote(id,p1,cap-1); conserved(); market.settle(id,proof()); conserved(); vm.prank(p1); market.withdraw(payable(p2)); conserved(); require(p2.balance==cap-1); }
}
