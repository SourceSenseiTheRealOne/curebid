// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {CureTerms} from "./CureTerms.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
interface IAaveRepay { function repay(address,uint256,uint256,address) external returns(uint256); }
contract CureRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable pool; address public immutable asset; address public immutable debtToken;
    mapping(bytes32 => uint8) public outcome;
    event DebtRepaid(bytes32 indexed digest,address indexed borrower,address indexed provider,uint256 amount,uint256 executedAt);
    event ExecutionExpired(bytes32 indexed digest,address indexed borrower,address indexed provider,uint256 amount,uint256 expiredAt);
    constructor(address p, address a, address d) {
        require(block.chainid==11155111,"source chain");
        require(p.code.length>0 && a.code.length>0 && d.code.length>0,"missing code");
        (bool ok,bytes memory reserve)=p.staticcall(abi.encodeWithSignature("getReserveData(address)",a));
        require(ok && reserve.length>=352,"invalid reserve");
        uint256 variableDebt;
        assembly { variableDebt := mload(add(reserve,352)) }
        require(variableDebt==uint256(uint160(d)),"wrong debt token");
        pool=p; asset=a; debtToken=d;
    }
    function _validate(CureTerms.Terms calldata t) internal view returns(bytes32 digest) {
        require(t.sourceChain==block.chainid && t.router==address(this) && t.pool==pool && t.asset==asset,"source domain");
        require(t.destinationChain==102031 && t.market!=address(0) && t.requestId>0,"destination domain");
        require(t.borrower!=address(0) && t.provider!=address(0) && t.amount>0 && t.executeBy>0,"invalid terms");
        digest=CureTerms.hash(t); require(outcome[digest]==0,"terminal outcome");
    }
    function repay(CureTerms.Terms calldata t) external nonReentrant {
        bytes32 digest=_validate(t);
        require(msg.sender==t.provider && block.timestamp<=t.executeBy,"payer or deadline");
        uint256 beforeDebt=IERC20(debtToken).balanceOf(t.borrower);
        require(beforeDebt>=t.amount,"insufficient debt");
        IERC20 token=IERC20(asset);
        token.safeTransferFrom(msg.sender,address(this),t.amount);
        token.forceApprove(pool,t.amount);
        uint256 actual=IAaveRepay(pool).repay(asset,t.amount,2,t.borrower);
        token.forceApprove(pool,0);
        require(actual==t.amount,"partial repayment");
        uint256 afterDebt=IERC20(debtToken).balanceOf(t.borrower);
        require(beforeDebt>afterDebt,"no debt reduction");
        uint256 reduced=beforeDebt-afterDebt;
        // rayDiv rounds the burned scaled balance by <= 0.5 scaled unit.
        // Two rayMul balance reads add <= 1 base unit to the difference.
        // Bound that error using the live normalized index, not a fixed unit.
        (bool indexOk,bytes memory encodedIndex)=pool.staticcall(abi.encodeWithSignature("getReserveNormalizedVariableDebt(address)",asset));
        require(indexOk && encodedIndex.length==32,"debt index unavailable");
        uint256 index=abi.decode(encodedIndex,(uint256));
        require(index>=1e27,"invalid debt index");
        uint256 tolerance=index/(2e27)+(index%(2e27)==0?0:1)+1;
        require(reduced==actual || (reduced>actual ? reduced-actual : actual-reduced)<=tolerance,"debt accounting");
        outcome[digest]=1;
        emit DebtRepaid(digest,t.borrower,t.provider,actual,block.timestamp);
    }
    function expire(CureTerms.Terms calldata t) external nonReentrant {
        bytes32 digest=_validate(t); require(block.timestamp>t.executeBy,"not expired");
        outcome[digest]=2;
        emit ExecutionExpired(digest,t.borrower,t.provider,t.amount,block.timestamp);
    }
}
