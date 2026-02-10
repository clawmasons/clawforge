"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "@/lib/auth-client";

export function Header() {
  const { data: session, isPending } = useSession();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--color-cream)]/80 backdrop-blur-xl border-b border-[var(--color-border)]"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight"
        >
          Clawforge
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/programs"
            className="text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            Programs
          </Link>

          {isPending ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-[var(--color-border)]" />
          ) : session ? (
            <div className="flex items-center gap-3">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-coral)] text-xs font-bold text-white">
                  {session.user.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <span className="text-sm font-medium">
                {session.user.name}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-cream)]"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                signIn.social({
                  provider: "google",
                  callbackURL: `${window.location.origin}/programs`,
                })
              }
              className="rounded-full bg-[var(--color-coral)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
            >
              Sign Up
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
