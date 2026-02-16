"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

export default function SpaceSettingsPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const router = useRouter();

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

  const { data, isLoading } = trpc.spaces.get.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setDescription(data.description ?? "");
    }
  }, [data]);

  const utils = trpc.useUtils();
  const updateMutation = trpc.spaces.update.useMutation({
    onSuccess: () => {
      utils.spaces.get.invalidate({ spaceId });
      utils.spaces.list.invalidate();
    },
  });

  const deleteMutation = trpc.spaces.delete.useMutation({
    onSuccess: () => {
      router.push("/spaces");
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-coral)]" />
        </div>
      </main>
    );
  }

  if (!data) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await updateMutation.mutateAsync({
      spaceId,
      name: name.trim(),
      description: description.trim() || null,
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
      <Link
        href={`/spaces/${spaceId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-foreground)]"
      >
        &larr; Back to {data.name}
      </Link>

      <h1 className="mb-8 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
        Space Settings
      </h1>

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            maxLength={100}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            rows={3}
            maxLength={500}
          />
        </div>

        {updateMutation.error && (
          <p className="text-sm text-red-600">{updateMutation.error.message}</p>
        )}
        {updateMutation.isSuccess && (
          <p className="text-sm text-green-600">Settings saved.</p>
        )}

        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded-lg bg-[var(--color-coral)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>

      {/* Danger Zone */}
      {isAdminOrOwner && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="text-base font-bold text-red-700">Danger Zone</h2>
          <p className="mt-2 text-sm text-red-600">
            Deleting this space will permanently remove all its tasks and
            members. This action cannot be undone.
          </p>
          {deleteConfirm ? (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => deleteMutation.mutate({ spaceId })}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="text-sm text-[var(--color-muted)] hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Delete Space
            </button>
          )}
          {deleteMutation.error && (
            <p className="mt-2 text-sm text-red-600">{deleteMutation.error.message}</p>
          )}
        </div>
      )}
    </main>
  );
}
