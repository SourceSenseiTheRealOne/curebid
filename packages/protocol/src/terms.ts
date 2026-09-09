import { AbiCoder, id, keccak256 } from "ethers";
export const TERMS_TYPE =
  "tuple(uint256 destinationChain,address market,uint256 requestId,uint256 sourceChain,address router,address pool,address asset,address borrower,address provider,uint256 amount,uint256 executeBy)";
export function hashTerms(terms: readonly (string | bigint)[]): string {
  if (terms.length !== 11) throw new Error("Invalid terms");
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["bytes32", TERMS_TYPE],
      [id("CureBid.v1"), terms],
    ),
  );
}
