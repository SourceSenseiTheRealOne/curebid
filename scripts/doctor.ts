import type * as EthersCjs from "ethers" with { "resolution-mode": "require" };
import { createRequire } from "node:module";
const ethers: typeof EthersCjs = createRequire(import.meta.url)("ethers");
const { JsonRpcProvider, Contract } = ethers;
import { chainInfo } from "@gluwa/usc-sdk";
import {
  SOURCE_RPC,
  SETTLEMENT_RPC,
  SOURCE_CHAIN_ID,
  SETTLEMENT_CHAIN_ID,
  AAVE_POOL,
  USDC,
} from "../packages/protocol/src/index.js";
const source = new JsonRpcProvider(SOURCE_RPC),
  destination = new JsonRpcProvider(SETTLEMENT_RPC);
try {
  const [s, d, code, decimals, chains] = await Promise.all([
    source.getNetwork(),
    destination.getNetwork(),
    source.getCode(AAVE_POOL),
    new Contract(
      USDC,
      ["function decimals() view returns(uint8)"],
      source,
    ).getFunction("decimals")(),
    new chainInfo.PrecompileChainInfoProvider(destination).getSupportedChains(),
  ]);
  if (
    s.chainId !== BigInt(SOURCE_CHAIN_ID) ||
    d.chainId !== BigInt(SETTLEMENT_CHAIN_ID) ||
    code === "0x" ||
    decimals !== 6n
  )
    throw new Error("Network or Aave deployment mismatch");
  const supported = chains.find((c) => c.chainId === SOURCE_CHAIN_ID);
  if (!supported || supported.chainEncoding !== 1)
    throw new Error("Sepolia encoding not supported");
  console.log(
    JSON.stringify(
      {
        sourceChainId: Number(s.chainId),
        settlementChainId: Number(d.chainId),
        pool: AAVE_POOL,
        asset: USDC,
        decimals: Number(decimals),
        supported,
        attestation: await new chainInfo.PrecompileChainInfoProvider(
          destination,
        ).getLatestAttestedHeightAndHash(supported.chainKey),
      },
      null,
      2,
    ),
  );
} finally {
  source.destroy();
  destination.destroy();
}
