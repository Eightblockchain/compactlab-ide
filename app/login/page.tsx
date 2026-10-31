"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/components/auth/Turnstile";
import { CompactLabLogo } from "@/components/brand/CompactLabLogo";

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // A Turnstile token works once: remount the widget for a fresh one after a failed try.
  const [checkKey, setCheckKey] = useState(0);
  const waitingForCheck = Boolean(TURNSTILE_SITE_KEY) && !turnstileToken;

  useEffect(() => {
    const oauthErr = params.get("error");
    if (oauthErr) setError(oauthErr);
  }, [params]);

  useEffect(() => {
    if (!loading && user) router.replace("/playground");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password, turnstileToken ?? undefined);
      router.replace("/playground");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setTurnstileToken(null);
      setCheckKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="h-full overflow-y-auto flex flex-col items-center justify-center-safe bg-surface px-4 py-10">
      <div className="w-full max-w-md border border-border rounded-xl p-6 sm:p-7 bg-surface-elevated space-y-5">
        <div className="space-y-4">
          <CompactLabLogo height={32} className="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Log in to CompactLab</h1>
            <p className="text-sm text-text-muted mt-1">
              Playground access requires an account.{" "}
              <Link href="/signup" className="text-accent">
                Create free account
              </Link>
            </p>
          </div>
        </div>

        <OAuthButtons />

        <div className="flex items-center gap-3 text-2xs text-text-muted uppercase tracking-wide">
          <div className="flex-1 h-px bg-border" />
          or email
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-md bg-black/30 border border-border px-3 py-2 text-sm"
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-md bg-black/30 border border-border px-3 py-2 text-sm"
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Turnstile key={checkKey} onToken={setTurnstileToken} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || waitingForCheck}
            className="w-full rounded-md bg-accent text-black font-medium py-2 text-sm disabled:opacity-60"
          >
            {busy ? "Signing in…" : waitingForCheck ? "Checking you're human…" : "Log in"}
          </button>
        </form>
        <p className="text-2xs text-text-muted text-center">
          Deploy and Call require the{" "}
          <a href="https://1am.xyz/" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            1AM
          </a>{" "}
          wallet on Midnight Preprod.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="h-full overflow-y-auto flex flex-col items-center justify-center-safe bg-surface px-4 py-10">
          <div className="text-sm text-text-muted">Loading…</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
