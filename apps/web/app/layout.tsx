import type { Metadata } from "next";
import { WalletProvider } from "../components/Wallet";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist-mono/400.css";
import "./style.css";
export const metadata: Metadata = {
  title: "CureBid | Your debt. Their liquidity.",
  description:
    "Competing providers repay Aave debt. Attestcoin proof unlocks reimbursement on Creditcoin testnet.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <WalletProvider>
          <div id="content">{children}</div>
        </WalletProvider>
        <footer>
          <a className="brand" href="/">
            CureBid
          </a>
          <p>
            Testnet only. Not audited. No guaranteed liquidation protection.
            <br />
            Native CTC reimbursement is not a dollar price. Proof outages can
            delay settlement.
          </p>
          <a href="https://github.com/SourceSenseiTheRealOne/curebid">
            GitHub ↗
          </a>
        </footer>
      </body>
    </html>
  );
}
