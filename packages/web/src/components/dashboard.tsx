"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

const DISMISS_KEY = "clawforge-welcome-dismissed";

export function Dashboard() {
  const [bannerDismissed, setBannerDismissed] = useState(true);

  useEffect(() => {
    setBannerDismissed(localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  const dismissBanner = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setBannerDismissed(true);
  };

  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id;

  const { data: spaces, isLoading } = trpc.spaces.list.useQuery(undefined, {
    enabled: !!orgId,
  });

  if (!orgId) {
    return (
      <section className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-coral)]" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 pt-32 pb-16">
      {!bannerDismissed && (
        <div className="relative mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 pr-10 text-sm leading-relaxed text-[var(--color-muted)]">
          <button
            onClick={dismissBanner}
            aria-label="Dismiss welcome banner"
            className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:text-[var(--color-coral)]"
          >
            &times;
          </button>
          <p>
            <strong className="text-[var(--color-foreground)]">
              Clawforge is very new
            </strong>{" "}
            &mdash; welcome, and thank you for being here! We&rsquo;d love your
            feedback.
          </p>
          <p className="mt-2">
            Follow{" "}
            <a
              href="https://x.com/clawforged"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-coral)] underline underline-offset-2 hover:text-[var(--color-coral-deep)]"
            >
              @clawforged
            </a>{" "}
            on X for updates. Feature requests and bug reports &rarr;{" "}
            <a
              href="https://github.com/clawmasons/clawforge"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-coral)] underline underline-offset-2 hover:text-[var(--color-coral-deep)]"
            >
              clawmasons/clawforge
            </a>
            .
          </p>
        </div>
      )}

      <h1 className="mb-8 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
        {activeOrg.data?.name ?? "Dashboard"}
      </h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      ) : spaces && spaces.length > 0 ? (
        <div className="space-y-4">
          {spaces.map((s) => (
            <Link
              key={s.id}
              href={`/spaces/${s.id}`}
              className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-coral)]"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-[family-name:var(--font-display)] text-base font-bold">
                  {s.name}
                </h3>
                <span className="ml-4 shrink-0 rounded-full bg-[var(--color-cream)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
                  {s.taskCount} {s.taskCount === 1 ? "task" : "tasks"}
                </span>
              </div>
              {s.description && (
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {s.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">No spaces yet.</p>
          <Link
            href="/spaces"
            className="mt-4 inline-block rounded-full bg-[var(--color-coral)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
          >
            Browse Spaces
          </Link>
        </div>
      )}
    </section>
  );
}
