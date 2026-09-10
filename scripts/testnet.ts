// Project-owned testnet signers only. No server/browser imports of this module.
import { readFile, lstat, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import type * as EthersCjs from "ethers" with { "resolution-mode": "require" };
import { createRequire } from "node:module";
const { Wallet, Contract, JsonRpcProvider, parseEther }: typeof EthersCjs =
  createRequire(import.meta.url)("ethers");
import { proofProvider, chainInfo } from "@gluwa/usc-sdk";
import { validateDeployment } from "../packages/protocol/src/deployment.js";
import {
  SOURCE_RPC,
  SETTLEMENT_RPC,
  PROVER_URL,
  AAVE_POOL,
  USDC,
} from "../packages/protocol/src/chains.js";
const [command, flag, requestId, hash] = process.argv.slice(2);
const allowed = [
  "setup",
  "create",
  "create-expiry",
  "quote-a",
  "quote-b",
  "accept",
  "repay",
  "expire",
  "settle",
  "withdraw",
];
if (!command || !allowed.includes(command) || flag !== "--testnet")
  throw new Error(
    "Usage: pnpm testnet <setup|create|quote-a|quote-b|accept|repay|expire|settle|withdraw> --testnet [requestId] [sourceTxHash]",
  );
const source = new JsonRpcProvider(SOURCE_RPC),
  destination = new JsonRpcProvider(SETTLEMENT_RPC);
try {
  if (
    (await source.getNetwork()).chainId !== 11155111n ||
    (await destination.getNetwork()).chainId !== 102031n
  )
    throw new Error("Testnet chain mismatch");
  const d = validateDeployment(
    JSON.parse(await readFile("deployments/testnet.json", "utf8")),
  );
  for (const [addr, rpc] of [
    [d.router, source],
    [d.market, destination],
    [d.verifier, destination],
  ] as const)
    if ((await rpc.getCode(addr)) === "0x")
      throw new Error("Missing deployed contract");
  const keyPath = `${homedir()}/.local/share/curebid/keys/wallets.private.json`;
  const info = await lstat(keyPath);
  if (
    process.platform !== "linux" ||
    info.isSymbolicLink() ||
    (info.mode & 0o077) !== 0 ||
    info.uid !== process.getuid?.()
  )
    throw new Error("Unsafe custody");
  const keys = JSON.parse(await readFile(keyPath, "utf8")) as Record<
    string,
    string
  >;
  const wallet = (
    role: "borrower" | "providerA" | "providerB",
    rpc: InstanceType<typeof JsonRpcProvider>,
  ) => {
    const key = keys[role];
    if (!key) throw new Error("Missing isolated signer");
    return new Wallet(key, rpc);
  };
  const borrower = wallet("borrower", destination),
    a = wallet("providerA", destination),
    b = wallet("providerB", destination);
  const abi = JSON.parse(
    await readFile("apps/web/lib/CureMarket.json", "utf8"),
  );
  const rabi = JSON.parse(
    await readFile("apps/web/lib/CureRouter.json", "utf8"),
  );
  const market = new Contract(d.market, abi, destination);
  if (
    (await market.getFunction("router")()).toLowerCase() !==
      d.router.toLowerCase() ||
    (await market.getFunction("verifier")()).toLowerCase() !==
      d.verifier.toLowerCase()
  )
    throw new Error("Deployment binding mismatch");
  const evidence: Record<string, unknown>[] = [];
  async function send(
    c: InstanceType<typeof Contract>,
    method: string,
    args: unknown[],
    value?: bigint,
  ) {
    const options = { type: 2, ...(value === undefined ? {} : { value }) };
    await c.getFunction(method).staticCall(...args, options);
    const tx = await c.getFunction(method)(...args, options);
    console.log("Submitted", method, tx.hash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("Receipt failed");
    const record = {
      method,
      transactionHash: receipt.hash,
      block: receipt.blockNumber,
    };
    evidence.push(record);
    await mkdir("docs/evidence/transactions", { recursive: true });
    await writeFile(
      `docs/evidence/transactions/${receipt.hash}.json`,
      JSON.stringify(record, null, 2) + "\n",
    );
    return receipt;
  }
  const tokenAbi = [
    "function approve(address,uint256) returns(bool)",
    "function balanceOf(address) view returns(uint256)",
  ];
  if (command === "setup") {
    const borrowerSource = wallet("borrower", source),
      provider = wallet("providerA", source);
    const debt = new Contract(d.debtToken, tokenAbi, source);
    if ((await debt.getFunction("balanceOf")(borrower.address)) > 0n)
      throw new Error(
        "Borrower already has debt; setup refuses duplicate borrowing",
      );
    const faucet = "0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D",
      collateral = "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5";
    const f = new Contract(
      faucet,
      ["function mint(address,address,uint256) returns(uint256)"],
      borrowerSource,
    );
    await send(f, "mint", [collateral, borrower.address, 1000n * 10n ** 18n]);
    await send(new Contract(collateral, tokenAbi, borrowerSource), "approve", [
      AAVE_POOL,
      1000n * 10n ** 18n,
    ]);
    const pool = new Contract(
      AAVE_POOL,
      [
        "function supply(address,uint256,address,uint16)",
        "function borrow(address,uint256,uint256,uint16,address)",
      ],
      borrowerSource,
    );
    await send(pool, "supply", [
      collateral,
      1000n * 10n ** 18n,
      borrower.address,
      0,
    ]);
    await send(pool, "borrow", [USDC, 10_000_000n, 2, 0, borrower.address]);
    await send(
      new Contract(
        faucet,
        ["function mint(address,address,uint256) returns(uint256)"],
        provider,
      ),
      "mint",
      [USDC, provider.address, 3_000_000n],
    );
    const actual = await debt.getFunction("balanceOf")(borrower.address);
    if (actual < 10_000_000n) throw new Error("Debt setup readback failed");
    console.log("Aave debt base units", String(actual));
  } else if (command === "create" || command === "create-expiry") {
    const block = await destination.getBlock("latest");
    if (!block) throw new Error("No latest block");
    const receipt = await send(
      new Contract(d.market, abi, borrower),
      "createRequest",
      [
        3_000_000n,
        block.timestamp + (command === "create-expiry" ? 180 : 1800),
        block.timestamp + (command === "create-expiry" ? 600 : 7200),
      ],
      parseEther("0.1"),
    );
    const log = receipt.logs
      .map((l: { topics: readonly string[]; data: string }) => {
        try {
          return market.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((l: { name: string } | null) => l?.name === "RequestCreated");
    if (!log) throw new Error("Request event missing");
    const created = await market.getFunction("getRequest")(log.args[0]);
    if (
      Number(created.state) !== 1 ||
      created.borrower.toLowerCase() !== borrower.address.toLowerCase()
    )
      throw new Error("Create readback failed");
    console.log("Request ID", String(log.args[0]));
  } else if (command === "withdraw") {
    for (const s of [borrower, a, b]) {
      if ((await market.getFunction("credits")(s.address)) > 0n) {
        await send(new Contract(d.market, abi, s), "withdraw", [s.address]);
        if ((await market.getFunction("credits")(s.address)) !== 0n)
          throw new Error("Credit not cleared");
      }
    }
  } else {
    if (!requestId || !/^[1-9][0-9]{0,19}$/.test(requestId))
      throw new Error("Explicit request ID required");
    const id = BigInt(requestId),
      request = await market.getFunction("getRequest")(id);
    if (command === "quote-a" || command === "quote-b") {
      const s = command === "quote-a" ? a : b;
      const reimbursement = parseEther(command === "quote-a" ? "0.07" : "0.09");
      await send(new Contract(d.market, abi, s), "submitQuote", [
        id,
        reimbursement,
      ]);
      if ((await market.getFunction("quotes")(id, s.address)) !== reimbursement)
        throw new Error("Quote readback failed");
    }
    if (command === "accept") {
      await send(new Contract(d.market, abi, borrower), "acceptQuote", [
        id,
        a.address,
        parseEther("0.07"),
      ]);
      if (
        (await market.getFunction("getRequest")(id)).provider.toLowerCase() !==
        a.address.toLowerCase()
      )
        throw new Error("Provider readback failed");
    }
    if (command === "repay" || command === "expire") {
      if (Number(request.state) !== 2)
        throw new Error("Request is not assigned");
      const terms = Array.from(await market.getFunction("getTerms")(id));
      const s = wallet("providerA", source);
      if (request.provider.toLowerCase() !== s.address.toLowerCase())
        throw new Error("Wrong selected provider");
      const router = new Contract(d.router, rabi, s);
      const outcome = Number(
        await router.getFunction("outcome")(request.digest),
      );
      if (outcome !== 0) {
        console.log("Source already terminal; no duplicate payment", outcome);
      } else {
        if (command === "repay")
          await send(new Contract(USDC, tokenAbi, s), "approve", [
            d.router,
            request.amount,
          ]);
        await send(router, command, [terms]);
        if (
          Number(await router.getFunction("outcome")(request.digest)) !==
          (command === "repay" ? 1 : 2)
        )
          throw new Error("Source outcome readback failed");
      }
    }
    if (command === "settle") {
      if (Number(request.state) === 3 || Number(request.state) === 4) {
        console.log("Already settled; no duplicate transaction");
      } else {
        if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash))
          throw new Error("Source transaction hash required");
        const supported = (
          await new chainInfo.PrecompileChainInfoProvider(
            destination,
          ).getSupportedChains()
        ).find((c) => c.chainId === 11155111 && c.chainEncoding === 1);
        if (supported?.chainKey !== d.chainKey)
          throw new Error("Attestation chain mismatch");
        const proof = await new proofProvider.service.ProofBuilder(
          d.chainKey,
          PROVER_URL,
        ).getProof(hash);
        if (!proof.success || !proof.data)
          throw new Error(
            "Proof pending. Retry this same command after attestation; no payment repeated.",
          );
        const p = proof.data;
        await send(new Contract(d.market, abi, borrower), "settle", [
          id,
          {
            chainKey: p.chainKey,
            height: p.headerNumber,
            txBytes: p.txBytes,
            merkle: p.merkleProof,
            continuity: p.continuityProof,
          },
        ]);
        const state = Number(
          (await market.getFunction("getRequest")(id)).state,
        );
        if (state !== 3 && state !== 4)
          throw new Error("Settlement readback failed");
        console.log("Terminal destination state", state);
      }
    }
  }
  console.log(
    JSON.stringify({ command, confirmedTransactions: evidence }, null, 2),
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : "Testnet command failed");
  process.exitCode = 1;
} finally {
  source.destroy();
  destination.destroy();
}
