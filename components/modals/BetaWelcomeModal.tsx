"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useLaceWallet } from "@/hooks/useLaceWallet";
import type { BetaMembership } from "@/lib/api";
import {
  claimPendingInvite,
  markWelcomed,
  openHelloMidnight,
  shouldWelcome,
} from "@/lib/beta-invite";
import { SPONSORED_FEES_ENABLED } from "@/lib/fee-mode";
import { refreshSponsorStatus } from "@/lib/sponsor-status";
import { useUserSettings } from "@/lib/user-settings";
import { useIDEStore } from "@/store/ide";
import { cn } from "@/lib/utils";

/**
 * After someone arrives through a beta invite link: join it, open Hello, Midnight!
 * on Preprod with Sponsored fees, and show the steps once.
 */
export function BetaWelcome() {
  const [membership, setMembership] = useState<BetaMembership | null>(null);

  useEffect(() => {
    let cancelled = false;
    void claimPendingInvite().then((m) => {
      if (cancelled || !m) return;
      openHelloMidnight();
      useUserSettings.getState().setNetwork("preprod");
      if (SPONSORED_FEES_ENABLED && m.state !== "waitlist" && m.state !== "removed") {
        useIDEStore.getState().setFeeMode("sponsored");
      }
      void refreshSponsorStatus();
      if (shouldWelcome(m)) setMembership(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!membership) return null;
  const close = () => {
    markWelcomed(membership);
    setMembership(null);
  };
  return <BetaWelcomeModal membership={membership} onClose={close} />;
}

function BetaWelcomeModal({ membership, onClose }: { membership: BetaMembership; onClose: () => void }) {
  const { user } = useAuth();
  const wallet = useLaceWallet();
  const emailConfirmed = user?.emailVerified !== false;
  const left = Math.max(0, membership.seats - membership.seatsTaken);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const seatLine =
    membership.state === "waitlist"
      ? `All ${membership.seats} sponsored seats are taken. You're #${membership.waitlistPosition} on the waitlist. You can still deploy now with your own tDUST (Self-pay).`
      : membership.state === "seat" || membership.state === "approved"
        ? "You have a sponsored seat. CompactLab pays your network fees."
        : `${left} of ${membership.seats} sponsored seats left. Your first successful deploy claims one, so don't wait.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-welcome-title"
        className="relative w-full max-w-[480px] rounded-xl p-5 space-y-4"
        style={{
          background: "#121215",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.12em] text-accent font-medium">{membership.inviteName}</p>
          <h2 id="beta-welcome-title" className="text-base font-semibold text-text-primary">
            Welcome to the CompactLab beta
          </h2>
          <p
            className={cn(
              "text-sm leading-relaxed",
              membership.state === "waitlist" ? "text-warning" : "text-text-secondary",
            )}
          >
            {seatLine}
          </p>
        </div>

        <ol className="space-y-2.5">
          <Step done={emailConfirmed} n={1}>
            {emailConfirmed ? (
              "Email confirmed."
            ) : (
              <>
                Confirm your email. We sent a link to <span className="text-text-primary">{user?.email}</span>.
              </>
            )}
          </Step>
          <Step done={wallet.isInstalled} n={2}>
            Install the{" "}
            <a href="https://1am.xyz/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              1AM wallet
            </a>
            , create a wallet and set its network to <span className="text-text-primary">Preprod</span>.
          </Step>
          <Step n={3}>
            Click <span className="text-text-primary font-medium">Deploy</span> (top right). The Hello, Midnight! project
            is open and ready. Approve the proof in 1AM; it takes 1 to 2 minutes.
          </Step>
          <Step n={4}>
            Open the <span className="text-text-primary font-medium">Contract</span> panel and call{" "}
            <code className="font-mono text-xs text-text-primary">storeMessage</code> with your own message.
          </Step>
        </ol>

        <p className="text-xs text-text-muted leading-relaxed">
          Something unclear or broken? Tell us in the Discord thread where you found the link. That feedback is the
          point of this beta.
        </p>

        <div className="flex justify-end pt-1">
          <Button variant="accent" size="md" onClick={onClose}>
            Let&apos;s go
          </Button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-text-secondary leading-relaxed">
      <span
        className={cn(
          "mt-0.5 flex size-5 flex-shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
          done ? "bg-success/15 text-success" : "bg-white/[0.06] text-text-muted",
        )}
      >
        {done ? "✓" : n}
      </span>
      <span>{children}</span>
    </li>
  );
}
