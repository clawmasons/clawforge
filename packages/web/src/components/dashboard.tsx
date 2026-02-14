"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { programs as catalog } from "@/data/programs";

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

  const { data: orgPrograms, isLoading } =
    trpc.organizations.programs.useQuery(
      { organizationId: orgId! },
      { enabled: !!orgId },
    );

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
      ) : orgPrograms && orgPrograms.length > 0 ? (
        <div className="space-y-4">
          {orgPrograms.map((p) => {
            const info = catalog.find((c) => c.id === p.programId);
            return (
              <Link
                key={p.id}
                href={`/programs/${p.programId}`}
                className="block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-coral)]"
              >
                <h3 className="font-[family-name:var(--font-display)] text-base font-bold">
                  {info?.name ?? p.programId}
                </h3>
                {info?.description && (
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {info.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">No programs yet.</p>
          <Link
            href="/programs"
            className="mt-4 inline-block rounded-full bg-[var(--color-coral)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
          >
            Browse Programs
          </Link>
        </div>
      )}
    </section>
  );
}
