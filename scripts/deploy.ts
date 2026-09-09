// Explicit testnet signing command. Only fresh, project-owned Linux custody.
import { readFile, lstat, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import type * as EthersCjs from "ethers" with { "resolution-mode": "require" };
import { createRequire } from "node:module";
const {
  Wallet,
  JsonRpcProvider,
  ContractFactory,
  Contract,
  getCreateAddress,
  keccak256,
}: typeof EthersCjs = createRequire(import.meta.url)("ethers");
type Wallet = EthersCjs.Wallet;
import { chainInfo } from "@gluwa/usc-sdk";
import {
  SOURCE_RPC,
  SETTLEMENT_RPC,
  AAVE_POOL,
  USDC,
} from "../packages/protocol/src/chains.js";
if (process.argv[2] !== "--testnet")
  throw new Error("Explicit --testnet required");
const source = new JsonRpcProvider(SOURCE_RPC),
  destination = new JsonRpcProvider(SETTLEMENT_RPC);
try {
  if (
    (await source.getNetwork()).chainId !== 11155111n ||
    (await destination.getNetwork()).chainId !== 102031n
  )
    throw new Error("Network mismatch");
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
  const key = keys.borrower;
  if (!key) throw new Error("Missing project borrower");
  const ss = new Wallet(key, source),
    ds = new Wallet(key, destination);
  if (
    (await source.getBalance(ss.address)) === 0n ||
    (await destination.getBalance(ds.address)) === 0n
  )
    throw new Error(
      `Funding required: ${ss.address} needs Sepolia ETH and testnet CTC`,
    );
  const supported = (
    await new chainInfo.PrecompileChainInfoProvider(
      destination,
    ).getSupportedChains()
  ).find((c) => c.chainId === 11155111 && c.chainEncoding === 1);
  if (!supported) throw new Error("Sepolia attestation missing");
  const debtToken = "0x36B5dE936eF1710E1d22EabE5231b28581a92ECc";
  await mkdir("deployments", { recursive: true });
  // Refuse replacement of an existing deployment. Recovery is explicit, not duplicate signing.
  try {
    await lstat("deployments/testnet.json");
    throw new Error("Deployment already exists");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  type RecordEntry = {
    address: string;
    transactionHash: string;
    block: number;
    initHash: string;
  };
  let records: Record<string, RecordEntry> = {};
  try {
    records = JSON.parse(
      await readFile("deployments/transactions.json", "utf8"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  async function save() {
    await writeFile(
      "deployments/transactions.json",
      JSON.stringify(records, null, 2),
    );
  }
  async function deploy(name: string, args: unknown[], signer: Wallet) {
    const a = JSON.parse(
      await readFile(`out/${name}.sol/${name}.json`, "utf8"),
    );
    const f = new ContractFactory(a.abi, a.bytecode.object, signer);
    const tx = await f.getDeployTransaction(...args, { type: 2 });
    const initHash = keccak256(tx.data as string);
    const prior = records[name];
    if (prior) {
      if (prior.initHash !== initHash)
        throw new Error("Existing deployment has different constructor/code");
      if (!prior.transactionHash)
        throw new Error(
          `Interrupted pre-broadcast intent for ${name}; inspect nonce and ${prior.address} before manual recovery`,
        );
      const receipt = await signer.provider!.getTransactionReceipt(
        prior.transactionHash,
      );
      const transaction = await signer.provider!.getTransaction(
        prior.transactionHash,
      );
      if (
        !receipt ||
        receipt.status !== 1 ||
        !transaction ||
        transaction.from.toLowerCase() !== signer.address.toLowerCase() ||
        keccak256(transaction.data) !== initHash ||
        receipt.contractAddress?.toLowerCase() !== prior.address.toLowerCase()
      )
        throw new Error(
          "Existing deployment pending or mismatched; never redeploy automatically",
        );
      if ((await signer.provider!.getCode(prior.address)) === "0x")
        throw new Error("Missing recovered code");
      prior.block = receipt.blockNumber;
      await save();
      console.log("Recovered", name, prior.address);
      return prior.address;
    }
    await signer.estimateGas(tx);
    const nonce = await signer.getNonce("pending");
    const address = getCreateAddress({ from: signer.address, nonce });
    // Write intent before broadcast; interruption cannot silently issue another deployment.
    records[name] = { address, transactionHash: "", block: 0, initHash };
    await save();
    const c = await f.deploy(...args, { type: 2, nonce });
    records[name]!.transactionHash = c.deploymentTransaction()!.hash;
    await save();
    const receipt = await c.deploymentTransaction()!.wait();
    if (
      !receipt ||
      receipt.status !== 1 ||
      (await signer.provider!.getCode(address)) === "0x"
    )
      throw new Error("Deployment not confirmed");
    records[name]!.block = receipt.blockNumber;
    await save();
    console.log(name, address, receipt.hash);
    return address;
  }
  const router = await deploy("CureRouter", [AAVE_POOL, USDC, debtToken], ss);
  const verifier = await deploy(
    "AttestcoinVerifier",
    [supported.chainKey, router, AAVE_POOL, USDC],
    ds,
  );
  const market = await deploy(
    "CureMarket",
    [router, AAVE_POOL, USDC, verifier],
    ds,
  );
  const m = new Contract(
    market,
    [
      "function router() view returns(address)",
      "function verifier() view returns(address)",
    ],
    destination,
  );
  if (
    (await m.getFunction("router")()).toLowerCase() !== router.toLowerCase() ||
    (await m.getFunction("verifier")()).toLowerCase() !== verifier.toLowerCase()
  )
    throw new Error("Deployment readback mismatch");
  const manifest = {
    sourceChainId: 11155111,
    settlementChainId: 102031,
    chainKey: supported.chainKey,
    router,
    market,
    verifier,
    debtToken,
    sourceBlock: records.CureRouter!.block,
    settlementBlock: records.CureMarket!.block,
  };
  await writeFile(
    "deployments/testnet.json",
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx" },
  );
  await mkdir("apps/web/public", { recursive: true });
  await writeFile(
    "apps/web/public/deployment.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
} finally {
  source.destroy();
  destination.destroy();
}
