"use client";

import { MidnightWalletProvider } from "@/hooks/useLaceWallet";

export function Providers({ children }: { children: React.ReactNode }) {
  return <MidnightWalletProvider>{children}</MidnightWalletProvider>;
}
