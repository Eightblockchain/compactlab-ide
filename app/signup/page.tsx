"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function SignupPage() {
  const { signup, user, loading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/playground");
  }, [loading, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(email, password, name || undefined);
      router.replace("/playground");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md border border-border rounded-xl p-6 bg-surface-elevated space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Start free</h1>
          <p className="text-sm text-text-muted mt-1">
            Free plan: Compile then Deploy with 1AM. Hello/Counter also ship bundled keys. Already have an account?{" "}
            <Link href="/login" className="text-accent">
              Log in
            </Link>
          </p>
        </div>

        <OAuthButtons labelPrefix="Sign up" />

        <div className="flex items-center gap-3 text-2xs text-text-muted uppercase tracking-wide">
          <div className="flex-1 h-px bg-border" />
          or email
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded-md bg-black/30 border border-border px-3 py-2 text-sm"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            minLength={8}
            placeholder="Password (min 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-accent text-black font-medium py-2 text-sm disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create free account"}
          </button>
        </form>
      </div>
    </main>
  );
}
