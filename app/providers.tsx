"use client";

import { MidnightWalletProvider } from "@/hooks/useLaceWallet";
import { AuthProvider } from "@/hooks/useAuth";
import { MaintenanceScreen } from "@/components/layout/MaintenanceScreen";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MidnightWalletProvider>{children}</MidnightWalletProvider>
      <MaintenanceScreen />
    </AuthProvider>
  );
}
