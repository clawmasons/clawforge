"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { programs as catalog } from "@/data/programs";

export default function ProgramViewPage() {
  const { programId } = useParams<{ programId: string }>();
  const { data: session, isPending: sessionLoading } = useSession();

  const info = catalog.find((c) => c.id === programId);

  const { data, isLoading, error } = trpc.programs.details.useQuery(
    { programId },
    { enabled: !!session },
  );

  if (sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="pt-24">
        <section className="mx-auto max-w-3xl px-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              Please sign in to view this program.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pt-24">
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-foreground)]"
        >
          &larr; Back to Dashboard
        </Link>

        {/* Header */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="mb-3 flex flex-wrap gap-2">
            {info?.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  tag === "Open"
                    ? "bg-[var(--color-coral)] text-white"
                    : "bg-[var(--color-cream)] text-[var(--color-muted)]"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            {info?.name ?? programId}
          </h1>

          {info?.description && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              {info.description}
            </p>
          )}

          {isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-coral)]" />
              Loading...
            </div>
          ) : error ? (
            <p className="mt-4 text-sm text-red-600">{error.message}</p>
          ) : data ? (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-muted)]">
              <span>
                Launched by{" "}
                <strong className="text-[var(--color-foreground)]">
                  {data.launchedBy.name}
                </strong>
              </span>
              <span>
                {new Date(data.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ) : null}
        </div>

        {/* Bots Section */}
        <h2 className="mt-8 mb-4 font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
          Bots
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              />
            ))}
          </div>
        ) : error ? null : data && data.bots.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.bots.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-[var(--color-border)] last:border-b-0"
                  >
                    <td className="px-5 py-3 font-medium">{b.name}</td>
                    <td className="px-5 py-3 text-[var(--color-muted)]">
                      {b.currentRole ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          b.status === "running"
                            ? "bg-green-100 text-green-800"
                            : "bg-[var(--color-cream)] text-[var(--color-muted)]"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-muted)]">
                      {b.owner.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <p className="text-sm text-[var(--color-muted)]">
              No bots are currently running in this program.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
