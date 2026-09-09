"use client";
import { createContext, useContext, useEffect, useState } from "react";
import {
  BrowserProvider,
  type Eip1193Provider,
  type JsonRpcSigner,
} from "ethers";
import * as Dialog from "@radix-ui/react-dialog";
interface Injected extends Eip1193Provider {
  on?: (event: string, fn: () => void) => void;
  removeListener?: (event: string, fn: () => void) => void;
}
declare global {
  interface Window {
    ethereum?: Injected;
  }
}
const Context = createContext<{
  address: string;
  chain: number;
  signer: (chain: number) => Promise<JsonRpcSigner>;
}>({
  address: "",
  chain: 0,
  signer: async () => {
    throw new Error("Connect wallet");
  },
});
export const useWallet = () => useContext(Context);
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState(""),
    [chain, setChain] = useState(0),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    let live = true;
    const update = async () => {
      try {
        const accounts = (await eth.request({
          method: "eth_accounts",
        })) as string[];
        const cid = (await eth.request({ method: "eth_chainId" })) as string;
        if (live) {
          setAddress(accounts[0] ?? "");
          setChain(Number(cid));
        }
      } catch {
        if (live) {
          setAddress("");
          setChain(0);
        }
      }
    };
    void update();
    eth.on?.("accountsChanged", update);
    eth.on?.("chainChanged", update);
    return () => {
      live = false;
      eth.removeListener?.("accountsChanged", update);
      eth.removeListener?.("chainChanged", update);
    };
  }, []);
  async function connect() {
    setError("");
    if (!window.ethereum) {
      setError("No browser wallet detected");
      return;
    }
    try {
      const p = new BrowserProvider(window.ethereum);
      await p.send("eth_requestAccounts", []);
      setAddress(await (await p.getSigner()).getAddress());
      setChain(Number((await p.getNetwork()).chainId));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet connection rejected");
    }
  }
  async function signer(target: number) {
    if (!window.ethereum) throw new Error("No browser wallet detected");
    if (target !== 11155111 && target !== 102031)
      throw new Error("Testnet only");
    const p = new BrowserProvider(window.ethereum);
    if (Number((await p.getNetwork()).chainId) !== target)
      throw new Error(
        `Switch your wallet to ${target === 102031 ? "Creditcoin CC3 Testnet" : "Ethereum Sepolia"} first`,
      );
    const s = await p.getSigner();
    if ((await s.getAddress()).toLowerCase() !== address.toLowerCase())
      throw new Error("Wallet changed; reconnect");
    return s;
  }
  return (
    <Context.Provider value={{ address, chain, signer }}>
      <header className="nav">
        <a href="/" className="brand">
          <span className="mark" aria-hidden="true" />
          CureBid
        </a>
        <nav aria-label="Main">
          <a href="/repay">Repay</a>
          <a href="/providers">Provide liquidity</a>
          <a href="/verify">Verify</a>
        </nav>
        <div className="nav-actions">
          <Theme />
          <Dialog.Root
            open={open}
            onOpenChange={(value) => {
              setOpen(value);
              if (value && !window.ethereum)
                setError("No browser wallet detected");
            }}
          >
            <Dialog.Trigger asChild>
              <button>
                {address
                  ? `${address.slice(0, 6)}…${address.slice(-4)}`
                  : "Connect wallet"}
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="overlay" />
              <Dialog.Content className="dialog">
                <Dialog.Title>Connect your wallet</Dialog.Title>
                <Dialog.Description>
                  Use the same address on Sepolia and Creditcoin CC3 Testnet.
                  CureBid never asks for a private key.
                </Dialog.Description>
                {error && <p role="alert">{error}</p>}
                <button className="primary" onClick={() => void connect()}>
                  Connect browser wallet
                </button>
                <Dialog.Close asChild>
                  <button>Close</button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
      {children}
    </Context.Provider>
  );
}
function Theme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("curebid-theme");
    const d = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }, []);
  return (
    <button
      aria-label="Toggle color theme"
      className="theme"
      onClick={() => {
        document.documentElement.dataset.theme = !dark ? "dark" : "light";
        localStorage.setItem("curebid-theme", !dark ? "dark" : "light");
        setDark(!dark);
      }}
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}
