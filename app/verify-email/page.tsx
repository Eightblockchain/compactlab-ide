"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { CompactLabLogo } from "@/components/brand/CompactLabLogo";

type State = { status: "working" } | { status: "done" } | { status: "error"; message: string };

function VerifyEmailInner() {
  const params = useSearchParams();
  const { user, refresh } = useAuth();
  const token = params.get("token");
  const [state, setState] = useState<State>(
    token
      ? { status: "working" }
      : { status: "error", message: "This link is missing its code. Open the link from the email again." },
  );
  const started = useRef(false);

  useEffect(() => {
    // The link is one-time: never post it twice (React may run effects twice in dev).
    if (started.current || !token) return;
    started.current = true;
    createBrowserApi()
      .verifyEmail(token)
      .then(async () => {
        await refresh();
        setState({ status: "done" });
      })
      .catch((e) => setState({ status: "error", message: e instanceof Error ? e.message : "Confirmation failed" }));
  }, [token, refresh]);

  return (
    <div className="space-y-3">
      {state.status === "working" && <p className="text-sm text-text-muted">Confirming your email…</p>}
      {state.status === "done" && (
        <>
          <h1 className="text-xl font-semibold text-text-primary">Email confirmed</h1>
          <p className="text-sm text-text-muted">
            {user
              ? "You can now deploy and call contracts."
              : "Log in the same way you signed up: with your email and password, or with Google or GitHub."}
          </p>
          <Link
            href={user ? "/playground" : "/login"}
            className="block w-full text-center rounded-md bg-accent text-black font-medium py-2 text-sm"
          >
            {user ? "Open the playground" : "Log in"}
          </Link>
        </>
      )}
      {state.status === "error" && (
        <>
          <h1 className="text-xl font-semibold text-text-primary">Could not confirm your email</h1>
          <p className="text-sm text-red-400">{state.message}</p>
          <p className="text-sm text-text-muted">
            In the playground, click <span className="text-text-primary">Resend email</span> in the yellow bar to get a
            new link.
          </p>
          <Link href={user ? "/playground" : "/login"} className="inline-block text-sm text-accent">
            {user ? "Open the playground" : "Log in"}
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="h-full overflow-y-auto flex flex-col items-center justify-center-safe bg-surface px-4 py-10">
      <div className="w-full max-w-md border border-border rounded-xl p-6 sm:p-7 bg-surface-elevated space-y-5">
        <CompactLabLogo height={32} className="h-8 w-auto" />
        <Suspense fallback={<p className="text-sm text-text-muted">Confirming your email…</p>}>
          <VerifyEmailInner />
        </Suspense>
      </div>
    </main>
  );
}
