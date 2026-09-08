// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {CureTerms} from "./CureTerms.sol";
import {CureProof,IOutcomeVerifier} from "./CureProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract CureMarket is ReentrancyGuard {
    enum State { None, Open, Assigned, Settled, Refunded, Cancelled }
    struct Request { address borrower; uint256 amount; uint256 cap; uint256 quoteBy; uint256 executeBy; address provider; uint256 reimbursement; bytes32 digest; State state; }
    address public immutable router; address public immutable pool; address public immutable asset;
    IOutcomeVerifier public immutable verifier;
    uint256 public nextId=1; uint256 public reserved; uint256 public totalCredits;
    mapping(uint256=>Request) internal requests;
    mapping(uint256=>mapping(address=>uint256)) public quotes;
    mapping(address=>uint256) public credits;
    mapping(bytes32=>bool) public usedProofs;
    mapping(uint256=>address[]) internal providers;
    event RequestCreated(uint256 indexed id,address indexed borrower,uint256 amount,uint256 cap,uint256 quoteBy,uint256 executeBy);
    event QuoteSubmitted(uint256 indexed id,address indexed provider,uint256 reimbursement);
    event QuoteAccepted(uint256 indexed id,address indexed provider,uint256 reimbursement,bytes32 digest);
    event RequestClosed(uint256 indexed id,State state,bytes32 proofKey);
    event Withdrawn(address indexed owner,address indexed to,uint256 amount);
    constructor(address r,address p,address a,IOutcomeVerifier v) {
        require(block.chainid==102031,"settlement chain");
        require(r!=address(0) && p!=address(0) && a!=address(0) && address(v).code.length>0,"configuration");
        router=r; pool=p; asset=a; verifier=v;
    }
    function getRequest(uint256 id) external view returns(Request memory) { return requests[id]; }
    function getProviders(uint256 id) external view returns(address[] memory) { return providers[id]; }
    function getTerms(uint256 id) public view returns(CureTerms.Terms memory) {
        Request storage r=requests[id];
        require(r.state!=State.None,"unknown request");
        return CureTerms.Terms(block.chainid,address(this),id,11155111,router,pool,asset,r.borrower,r.provider,r.amount,r.executeBy);
    }
    function _credit(address to,uint256 amount) internal { credits[to]+=amount; totalCredits+=amount; }
    function createRequest(uint256 amount,uint256 quoteBy,uint256 executeBy) external payable returns(uint256 id) {
        require(amount>0 && msg.value>0,"positive amounts");
        require(quoteBy>=block.timestamp+60 && executeBy>=quoteBy+300 && executeBy<=block.timestamp+7 days,"windows");
        id=nextId++;
        requests[id]=Request(msg.sender,amount,msg.value,quoteBy,executeBy,address(0),0,bytes32(0),State.Open);
        reserved+=msg.value;
        emit RequestCreated(id,msg.sender,amount,msg.value,quoteBy,executeBy);
    }
    function submitQuote(uint256 id,uint256 reimbursement) external {
        Request storage r=requests[id];
        require(r.state==State.Open && block.timestamp<=r.quoteBy,"quote closed");
        require(reimbursement>0 && reimbursement<=r.cap,"quote cap");
        if(quotes[id][msg.sender]==0) { require(providers[id].length<32,"quote limit"); providers[id].push(msg.sender); }
        quotes[id][msg.sender]=reimbursement;
        emit QuoteSubmitted(id,msg.sender,reimbursement);
    }
    function acceptQuote(uint256 id,address provider,uint256 expected) external {
        Request storage r=requests[id];
        require(msg.sender==r.borrower && r.state==State.Open,"owner or state");
        require(block.timestamp<=r.quoteBy && r.executeBy>=block.timestamp+300,"selection deadline");
        uint256 selected=quotes[id][provider];
        require(selected>0 && selected==expected,"quote changed");
        r.provider=provider; r.reimbursement=selected; r.state=State.Assigned;
        r.digest=CureTerms.hash(getTerms(id));
        uint256 surplus=r.cap-selected; reserved-=surplus; _credit(r.borrower,surplus);
        emit QuoteAccepted(id,provider,selected,r.digest);
    }
    function cancelRequest(uint256 id) external {
        Request storage r=requests[id];
        require(msg.sender==r.borrower && r.state==State.Open,"owner or assigned");
        r.state=State.Cancelled; reserved-=r.cap; _credit(r.borrower,r.cap);
        emit RequestClosed(id,State.Cancelled,bytes32(0));
    }
    function settle(uint256 id,CureProof.Proof calldata proof) external nonReentrant {
        Request storage r=requests[id]; require(r.state==State.Assigned,"not assigned");
        CureTerms.Terms memory terms=getTerms(id);
        require(CureTerms.hash(terms)==r.digest,"terms mismatch");
        (uint8 result,bytes32 proofKey)=verifier.verify(proof,terms);
        require((result==1 || result==2) && !usedProofs[proofKey],"outcome or replay");
        usedProofs[proofKey]=true;
        r.state=result==1?State.Settled:State.Refunded;
        reserved-=r.reimbursement;
        _credit(result==1?r.provider:r.borrower,r.reimbursement);
        emit RequestClosed(id,r.state,proofKey);
    }
    function withdraw(address payable to) external nonReentrant {
        uint256 amount=credits[msg.sender]; require(amount>0 && to!=address(0),"no credit or recipient");
        credits[msg.sender]=0; totalCredits-=amount;
        (bool sent,)=to.call{value:amount}(""); require(sent,"withdrawal rejected");
        emit Withdrawn(msg.sender,to,amount);
    }
}
