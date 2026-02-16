"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

export default function SpacesPage() {
  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id;

  const { data: members } = trpc.organizations.members.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id;
  const currentRole = members?.find((m) => m.userId === currentUserId)?.role;
  const isAdminOrOwner = currentRole === "owner" || currentRole === "admin";

  const { data: spaces, isLoading } = trpc.spaces.list.useQuery(undefined, {
    enabled: !!orgId,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();
  const createMutation = trpc.spaces.create.useMutation({
    onSuccess: () => {
      utils.spaces.list.invalidate();
      setShowCreate(false);
      setName("");
      setDescription("");
    },
  });

  if (!orgId) {
    return (
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-coral)]" />
        </div>
      </main>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createMutation.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Spaces
        </h1>
        {isAdminOrOwner && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-full bg-[var(--color-coral)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
          >
            Create Space
          </button>
        )}
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-8 space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Team"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
              maxLength={100}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this space for?"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
              rows={2}
              maxLength={500}
            />
          </div>
          {createMutation.error && (
            <p className="text-sm text-red-600">{createMutation.error.message}</p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="rounded-lg bg-[var(--color-coral)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-base font-bold">
                    {s.name}
                  </h3>
                  {s.description && (
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                      {s.description}
                    </p>
                  )}
                </div>
                <span className="ml-4 shrink-0 rounded-full bg-[var(--color-cream)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]">
                  {s.taskCount} {s.taskCount === 1 ? "task" : "tasks"}
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                Created{" "}
                {new Date(s.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
          <p className="text-sm text-[var(--color-muted)]">No spaces yet.</p>
          {isAdminOrOwner && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-block rounded-full bg-[var(--color-coral)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
            >
              Create Your First Space
            </button>
          )}
        </div>
      )}
    </main>
  );
}
