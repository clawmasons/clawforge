"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/lib/auth-client";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const isDomainError =
    error === "FORBIDDEN" || error?.toLowerCase().includes("corporate");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          {isDomainError ? "Domain Not Allowed" : "Authentication Error"}
        </h1>
        <p className="mt-4 text-[var(--color-muted)]">
          {isDomainError
            ? "Only corporate Google accounts are allowed. Consumer email providers (Gmail, Yahoo, Outlook, etc.) are not supported."
            : "Something went wrong during authentication. Please try again."}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
            className="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-cream)]"
          >
            Sign Out
          </button>
          <Link
            href="/"
            className="rounded-full bg-[var(--color-coral)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
        </main>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
