"use client";

import { MidnightWalletProvider } from "@/hooks/useLaceWallet";
import { AuthProvider } from "@/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MidnightWalletProvider>{children}</MidnightWalletProvider>
    </AuthProvider>
  );
}
