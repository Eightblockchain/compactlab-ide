"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, createBrowserApi, type PublicInvite } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { rememberInvite } from "@/lib/beta-invite";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailSignupForm } from "@/components/auth/EmailSignupForm";
import { CompactLabLogo } from "@/components/brand/CompactLabLogo";

type Load = { status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ok"; invite: PublicInvite };

/**
 * Public beta invite (/join/<code>), shared in Discord. Remembers the code in this
 * browser; the playground joins it after any kind of sign-in.
 */
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? "";
  const router = useRouter();
  const { user, loading } = useAuth();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    createBrowserApi()
      .getInvite(code)
      .then(({ invite }) => {
        if (cancelled) return;
        if (invite.active) rememberInvite(invite.code);
        setLoad({ status: "ok", invite });
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setLoad({ status: "missing" });
        else setLoad({ status: "error", message: e instanceof Error ? e.message : "Could not load this invite" });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const goPlayground = () => router.push("/playground");

  return (
    <main className="h-full overflow-y-auto flex flex-col items-center justify-center-safe bg-surface px-4 py-10">
      <div className="w-full max-w-md border border-border rounded-xl p-6 sm:p-7 bg-surface-elevated space-y-5">
        <CompactLabLogo height={32} className="h-8 w-auto" />

        {load.status === "loading" && <p className="text-sm text-text-muted">Loading your invite…</p>}

        {(load.status === "missing" || load.status === "error") && (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-text-primary">
              {load.status === "missing" ? "This invite link doesn't exist" : "Could not load this invite"}
            </h1>
            <p className="text-sm text-text-muted">
              {load.status === "error"
                ? `${load.message}. Reload the page to try again.`
                : "Check the link you were sent. You can still use CompactLab and pay network fees with your own tDUST."}
            </p>
            <Link href="/signup" className="inline-block text-sm text-accent">
              Create a CompactLab account
            </Link>
          </div>
        )}

        {load.status === "ok" && (
          <>
            <InviteIntro invite={load.invite} />

            {!load.invite.active ? (
              <p className="text-sm text-text-muted">
                This invite is closed.{" "}
                <Link href={user ? "/playground" : "/signup"} className="text-accent">
                  {user ? "Open the playground" : "Create an account"}
                </Link>{" "}
                to use CompactLab with Self-pay fees.
              </p>
            ) : loading ? null : user ? (
              <div className="space-y-2">
                <p className="text-sm text-text-muted">
                  Signed in as <span className="text-text-primary">{user.email}</span>.
                </p>
                <button
                  type="button"
                  onClick={goPlayground}
                  className="w-full rounded-md bg-accent text-black font-medium py-2 text-sm"
                >
                  {load.invite.full ? "Join the waitlist" : "Join the beta"}
                </button>
              </div>
            ) : (
              <>
                <OAuthButtons labelPrefix="Join" />
                <div className="flex items-center gap-3 text-2xs text-text-muted uppercase tracking-wide">
                  <div className="flex-1 h-px bg-border" />
                  or email
                  <div className="flex-1 h-px bg-border" />
                </div>
                <EmailSignupForm onDone={goPlayground} submitLabel={load.invite.full ? "Join the waitlist" : "Join the beta"} />
                <p className="text-sm text-text-muted text-center">
                  Already have an account?{" "}
                  <Link href="/login" className="text-accent">
                    Log in
                  </Link>{" "}
                  and you&apos;ll join automatically.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function InviteIntro({ invite }: { invite: PublicInvite }) {
  const left = Math.max(0, invite.seats - invite.seatsTaken);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xs uppercase tracking-[0.12em] text-accent font-medium">You&apos;re invited</p>
        <h1 className="text-xl font-semibold text-text-primary mt-1">{invite.name}</h1>
        <p className="text-sm text-text-muted mt-1">
          Write a Midnight contract in your browser and deploy it to Preprod. CompactLab pays the network fees, so you
          don&apos;t need any tDUST.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-black/20 px-3 py-2.5 text-sm">
        {invite.full ? (
          <span className="text-warning">
            All {invite.seats} sponsored seats are taken. Join the waitlist and we&apos;ll let you in as seats open.
          </span>
        ) : (
          <span className="text-text-primary">
            <span className="font-semibold text-success">
              {left} of {invite.seats}
            </span>{" "}
            sponsored seats left. Seats go to the first people who deploy, not the first to sign up.
          </span>
        )}
      </div>
      <ol className="space-y-1.5 text-sm text-text-secondary list-decimal list-inside">
        <li>Create your account and confirm your email.</li>
        <li>
          Install the{" "}
          <a href="https://1am.xyz/" target="_blank" rel="noreferrer" className="text-accent">
            1AM wallet
          </a>{" "}
          and set it to Preprod.
        </li>
        <li>Deploy the Hello, Midnight! project with sponsored fees.</li>
      </ol>
    </div>
  );
}
