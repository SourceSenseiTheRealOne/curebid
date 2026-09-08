import type { Metadata } from "next";
export const metadata: Metadata = { title: "CureBid | Repay here. Keep your collateral there.", description: "Competing providers repay Aave debt on Sepolia. Attestcoin proof unlocks reimbursement on Creditcoin testnet." };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
