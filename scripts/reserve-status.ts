import { Contract, JsonRpcProvider, formatUnits } from "ethers";
import { AAVE_POOL, SOURCE_RPC } from "../packages/protocol/src/chains.js";
const rpc = new JsonRpcProvider(SOURCE_RPC);
try {
  const pool = new Contract(
    AAVE_POOL,
    [
      "function getReservesList() view returns(address[])",
      "function getReserveData(address) view returns(uint256,uint128,uint128,uint128,uint128,uint128,uint40,uint16,address,address,address,address,uint128,uint128,uint128)",
    ],
    rpc,
  );
  const faucet = new Contract(
    "0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D",
    ["function isMintable(address) view returns(bool)"],
    rpc,
  );
  for (const asset of await pool.getFunction("getReservesList")()) {
    const token = new Contract(
      asset,
      [
        "function symbol() view returns(string)",
        "function decimals() view returns(uint8)",
        "function balanceOf(address) view returns(uint256)",
        "function totalSupply() view returns(uint256)",
      ],
      rpc,
    );
    const r = await pool.getFunction("getReserveData")(asset);
    const at = new Contract(
      r[8],
      ["function totalSupply() view returns(uint256)"],
      rpc,
    );
    const dt = new Contract(
      r[10],
      ["function totalSupply() view returns(uint256)"],
      rpc,
    );
    const [symbol, decimals, supply, debt, mintable, liquidity] =
      await Promise.all([
        token.getFunction("symbol")(),
        token.getFunction("decimals")(),
        at.getFunction("totalSupply")(),
        dt.getFunction("totalSupply")(),
        faucet.getFunction("isMintable")(asset),
        token.getFunction("balanceOf")(r[8]),
      ]);
    console.log(
      JSON.stringify({
        asset,
        symbol,
        mintable,
        supply: formatUnits(supply, decimals),
        supplyCap: String((r[0] >> 116n) & ((1n << 36n) - 1n)),
        debt: formatUnits(debt, decimals),
        borrowCap: String((r[0] >> 80n) & ((1n << 36n) - 1n)),
        liquidity: formatUnits(liquidity, decimals),
      }),
    );
  }
} finally {
  rpc.destroy();
}
