"use client";

import { useIDEStore } from "@/store/ide";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import { cn } from "@/lib/utils";
import {
  APP_VERSION,
  COMPACT_COMPILER_PACKAGE,
  COMPACT_LANGUAGE_VERSION,
} from "@/lib/version";

/**
 * IDE status bar: network, wallet and toolchain at a glance. Holds the
 * details that used to be scattered over the sidebar footer, editor tab bar
 * and Topbar.
 */
export function StatusBar() {
  const status = useIDEStore((s) => s.status);
  const lace = useLaceWallet();
  const connected = lace.status === "connected" && !!lace.connectedAPI;
  const address = lace.walletInfo?.unshieldedAddress;

  const activity =
    status === "compiling"
      ? "Compiling…"
      : status === "deploying"
        ? "Deploying…"
        : status === "saving"
          ? "Saving…"
          : null;

  return (
    <footer className="flex-shrink-0 h-6 flex items-center gap-4 px-3 border-t border-border bg-background text-[11px] text-text-muted select-none">
      <span className="flex items-center gap-1.5" title="CompactLab deploys to Midnight Preprod only">
        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden />
        Midnight Preprod
      </span>

      <span className="flex items-center gap-1.5" title={connected ? address : "Deploy and Call need the 1AM wallet"}>
        <span
          aria-hidden
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            connected ? "bg-success" : lace.status === "error" ? "bg-warning" : "bg-text-dim",
          )}
        />
        {connected ? (
          <>
            1AM
            {address && (
              <span className="font-mono text-text-secondary">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            )}
          </>
        ) : (
          "1AM not connected"
        )}
      </span>

      {connected && lace.dustBalance && (
        <span
          className={cn("font-mono", lace.dustBalance.isEmpty ? "text-warning" : "text-text-secondary")}
          title={`tDUST generation cap ${lace.dustBalance.capLabel}`}
        >
          {lace.dustBalance.balanceLabel} tDUST
        </span>
      )}

      {activity && (
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span className="w-1.5 h-1.5 rounded-full bg-accent status-pulse" aria-hidden />
          {activity}
        </span>
      )}

      <div className="flex-1" />

      <span title={`Compact language ${COMPACT_LANGUAGE_VERSION}, compiler package +${COMPACT_COMPILER_PACKAGE}`}>
        Compact {COMPACT_LANGUAGE_VERSION}
        <span className="text-text-dim"> · </span>
        compiler {COMPACT_COMPILER_PACKAGE}
      </span>
      <span className="text-text-dim">v{APP_VERSION}</span>
    </footer>
  );
}
