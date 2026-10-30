"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailSignupForm } from "@/components/auth/EmailSignupForm";
import { CompactLabLogo } from "@/components/brand/CompactLabLogo";

export default function SignupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && user) router.replace("/playground");
  }, [loading, user, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md border border-border rounded-xl p-6 sm:p-7 bg-surface-elevated space-y-5">
        <div className="space-y-4">
          <CompactLabLogo height={32} className="h-8 w-auto" />
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Join CompactLab</h1>
            <p className="text-sm text-text-muted mt-1">
              Free for the Midnight community. Compile, then Deploy with 1AM on Preprod.
              Hello/Counter also ship bundled keys. Already have an account?{" "}
              <Link href="/login" className="text-accent">
                Log in
              </Link>
            </p>
          </div>
        </div>

        <OAuthButtons labelPrefix="Sign up" />

        <div className="flex items-center gap-3 text-2xs text-text-muted uppercase tracking-wide">
          <div className="flex-1 h-px bg-border" />
          or email
          <div className="flex-1 h-px bg-border" />
        </div>

        <EmailSignupForm onDone={() => router.replace("/playground")} />
      </div>
    </main>
  );
}
