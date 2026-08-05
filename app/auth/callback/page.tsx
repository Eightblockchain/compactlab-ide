"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setToken, createBrowserApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const err = params.get("error");
    if (err) {
      setError(err);
      return;
    }
    if (!code) {
      setError("Missing OAuth code");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const api = createBrowserApi();
        const res = await api.exchangeOAuthCode(code);
        if (cancelled) return;
        setToken(res.token);
        await refresh();
        router.replace("/playground");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "OAuth exchange failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, refresh, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="text-sm text-text-muted">
        {error ? (
          <div className="space-y-3 text-center">
            <p className="text-red-400">{error}</p>
            <a href="/login" className="text-accent">
              Back to login
            </a>
          </div>
        ) : (
          "Completing sign-in…"
        )}
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-surface px-4">
          <div className="text-sm text-text-muted">Completing sign-in…</div>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
