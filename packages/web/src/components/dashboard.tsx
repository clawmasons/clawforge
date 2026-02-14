"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { programs as catalog } from "@/data/programs";

export function Dashboard() {
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
              <div
                key={p.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <h3 className="font-[family-name:var(--font-display)] text-base font-bold">
                  {info?.name ?? p.programId}
                </h3>
                {info?.description && (
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {info.description}
                  </p>
                )}
              </div>
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
