// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {CureTerms} from "../src/CureTerms.sol";
import {CureRouter} from "../src/CureRouter.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function chainId(uint256) external;
    function expectRevert() external;
    function deal(address,uint256) external;
    function etch(address,bytes calldata) external;
    function createSelectFork(string calldata) external returns(uint256);
}
contract TestToken is ERC20 {
    constructor() ERC20("Isolated test token", "TEST") {}
    function mint(address to,uint256 n) external { _mint(to,n); }
    function burn(address to,uint256 n) external { _burn(to,n); }
}
contract TestPool {
    TestToken public asset; TestToken public debt; bool public shortPay;
    constructor(TestToken a,TestToken d) { asset=a; debt=d; }
    function setShort(bool b) external { shortPay=b; }
    function getReserveData(address) external view returns(uint256[16] memory r) { r[10]=uint160(address(debt)); }
    function repay(address a,uint256 n,uint256 mode,address borrower) external returns(uint256) {
        require(a==address(asset) && mode==2);
        uint256 actual=shortPay?n-1:n;
        asset.transferFrom(msg.sender,address(this),actual); debt.burn(borrower,actual);
        return actual;
    }
}
contract CureRouterTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    TestToken asset; TestToken debt; TestPool pool; CureRouter router;
    CureTerms.Terms terms;
    address borrower=address(0xB0); address provider=address(0xA1);
    function setUp() public {
        vm.chainId(11155111); vm.warp(1000);
        asset=new TestToken(); debt=new TestToken(); pool=new TestPool(asset,debt);
        router=new CureRouter(address(pool),address(asset),address(debt));
        terms=CureTerms.Terms(102031,address(0xC0),1,11155111,address(router),address(pool),address(asset),borrower,provider,300e6,2000);
        asset.mint(provider,300e6); debt.mint(borrower,1000e6);
        vm.prank(provider); asset.approve(address(router),300e6);
    }
    function testRepaymentReducesDebtAndClearsAllowance() public {
        vm.prank(provider); router.repay(terms);
        require(debt.balanceOf(borrower)==700e6,"debt not reduced");
        require(asset.balanceOf(provider)==0 && asset.balanceOf(address(router))==0,"stranded funds");
        require(asset.allowance(address(router),address(pool))==0,"lingering allowance");
        require(router.outcome(CureTerms.hash(terms))==1,"not repaid");
    }
    function testCannotExpireRepaidEvenWhenProofDelayed() public {
        vm.prank(provider); router.repay(terms); vm.warp(3000);
        vm.expectRevert(); router.expire(terms);
    }
    function testExpiryIsPermissionlessAndTerminal() public {
        vm.warp(2001); router.expire(terms);
        require(router.outcome(CureTerms.hash(terms))==2,"not expired");
        vm.prank(provider); vm.expectRevert(); router.repay(terms);
        vm.expectRevert(); router.expire(terms);
    }
    function testCannotExpireBeforeDeadline() public { vm.expectRevert(); router.expire(terms); }
    function testWrongProvider() public { vm.expectRevert(); router.repay(terms); }
    function testWrongSourceDomain() public { terms.sourceChain=1; vm.prank(provider); vm.expectRevert(); router.repay(terms); }
    function testWrongDestinationChain() public { terms.destinationChain=1; vm.prank(provider); vm.expectRevert(); router.repay(terms); }
    function testWrongAsset() public { terms.asset=address(debt); vm.prank(provider); vm.expectRevert(); router.repay(terms); }
    function testWrongPool() public { terms.pool=address(debt); vm.prank(provider); vm.expectRevert(); router.repay(terms); }
    function testZeroAmount() public { terms.amount=0; vm.prank(provider); vm.expectRevert(); router.repay(terms); }
    function testAfterDeadline() public { vm.warp(2001); vm.prank(provider); vm.expectRevert(); router.repay(terms); }
    function testUnderpaymentRevertsAllEffects() public {
        pool.setShort(true); vm.prank(provider); vm.expectRevert(); router.repay(terms);
        require(asset.balanceOf(provider)==300e6 && debt.balanceOf(borrower)==1000e6,"not atomic");
        require(router.outcome(CureTerms.hash(terms))==0,"terminal on failure");
    }
    function testHashDomainSeparation() public view {
        CureTerms.Terms memory changed=terms; bytes32 original=CureTerms.hash(changed);
        require(original!=bytes32(0)); changed.requestId++; require(CureTerms.hash(changed)!=original);
        changed=terms; changed.market=address(0xFF); require(CureTerms.hash(changed)!=original);
        changed=terms; changed.provider=borrower; require(CureTerms.hash(changed)!=original);
        changed=terms; changed.executeBy++; require(CureTerms.hash(changed)!=original);
    }
    function testAlternateTermsCannotExpireOriginal() public {
        CureTerms.Terms memory other=terms; other.amount++;
        vm.warp(2001); router.expire(other);
        require(router.outcome(CureTerms.hash(terms))==0,"other digest expired");
    }
}
