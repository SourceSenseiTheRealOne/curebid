// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Vm} from "./CureRouter.t.sol";
import {CureRouter} from "../src/CureRouter.sol";
import {CureTerms} from "../src/CureTerms.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IForkPool { function supply(address,uint256,address,uint16) external; function borrow(address,uint256,uint256,uint16,address) external; }
interface IFaucetAsset { function mint(address,uint256) external; }
interface VmFork { function createSelectFork(string calldata,uint256) external returns(uint256); }
contract AaveForkTest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant POOL=0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;
    address constant ASSET=0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
    address constant DEBT=0x36B5dE936eF1710E1d22EabE5231b28581a92ECc;
    function testRealAaveSupplyBorrowAndThirdPartyRepayment() public {
        VmFork(address(vm)).createSelectFork("https://ethereum-sepolia-rpc.publicnode.com",11660009);
        address borrower=address(0xB0110); address provider=address(0xA1110);
        CureRouter router=new CureRouter(POOL,ASSET,DEBT);
        address faucet=0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D;
        vm.prank(borrower); IFaucetAsset(faucet).mint(ASSET,10000e6);
        vm.prank(provider); IFaucetAsset(faucet).mint(ASSET,300e6);
        vm.startPrank(borrower);
        IERC20(ASSET).approve(POOL,10000e6);
        IForkPool(POOL).supply(ASSET,10000e6,borrower,0);
        IForkPool(POOL).borrow(ASSET,1000e6,2,0,borrower);
        vm.stopPrank();
        uint256 beforeDebt=IERC20(DEBT).balanceOf(borrower);
        CureTerms.Terms memory t=CureTerms.Terms(102031,address(0xC0),1,11155111,address(router),POOL,ASSET,borrower,provider,300e6,block.timestamp+3600);
        vm.startPrank(provider); IERC20(ASSET).approve(address(router),300e6); router.repay(t); vm.stopPrank();
        uint256 reduced=beforeDebt-IERC20(DEBT).balanceOf(borrower);
        require(reduced>=300e6-1 && reduced<=300e6+1,"actual Aave debt reduction");
        require(router.outcome(CureTerms.hash(t))==1 && IERC20(ASSET).allowance(address(router),POOL)==0);
        vm.warp(t.executeBy+1); vm.expectRevert(); router.expire(t);
    }
}
