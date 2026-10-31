"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Turnstile, TURNSTILE_SITE_KEY } from "@/components/auth/Turnstile";

const inputClass = "w-full rounded-md bg-black/30 border border-border px-3 py-2 text-sm";

/** Email + password signup with the bot check. Calls onDone once the account exists. */
export function EmailSignupForm({ onDone, submitLabel = "Create account" }: { onDone: () => void; submitLabel?: string }) {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  // A Turnstile token works once: remount the widget for a fresh one after a failed try.
  const [checkKey, setCheckKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const waitingForCheck = Boolean(TURNSTILE_SITE_KEY) && !turnstileToken;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(email, password, name || undefined, turnstileToken ?? undefined);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
      setTurnstileToken(null);
      setCheckKey((k) => k + 1);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className={inputClass} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className={inputClass}
        type="email"
        required
        autoComplete="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className={inputClass}
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="Password (min 8)"
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
        {busy ? "Creating…" : waitingForCheck ? "Checking you're human…" : submitLabel}
      </button>
      <p className="text-2xs text-text-muted text-center">We&apos;ll email you a link to confirm your address.</p>
    </form>
  );
}
