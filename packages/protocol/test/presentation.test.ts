import {expect,test} from "vitest";
import {requestPhase,requestInput} from "../src/presentation.js";
test("assigned escrow remains proof-pending after execution expiry",()=>{ expect(requestPhase(2,100,101)).toBe("proof-pending"); });
test("only authenticated contract state renders terminal success",()=>{ expect(requestPhase(2,200,100)).toBe("assigned"); expect(requestPhase(3,200,100)).toBe("settled"); expect(requestPhase(4,200,100)).toBe("refunded"); });
test("unknown contract states do not render success",()=>{expect(()=>requestPhase(9,200,100)).toThrow();});
test("USDC and CTC are parsed independently without exchange conversion",()=>{expect(requestInput("300.000001","2.05")).toEqual({amount:300000001n,cap:2050000000000000000n});});
test("zero, negative, exponent and overprecision amounts are rejected",()=>{for(const [a,c] of [["0","2"],["3","0"],["-3","2"],["3e2","2"],["3.0000001","2"]]) expect(()=>requestInput(a!,c!)).toThrow();});
