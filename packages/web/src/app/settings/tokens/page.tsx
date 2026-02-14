"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

export default function TokensPage() {
  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id;

  const { data: members } = trpc.organizations.members.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id;
  const isOwner = members?.some(
    (m) => m.userId === currentUserId && m.role === "owner",
  );

  const { data: tokens, refetch } = trpc.organizations.tokens.list.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId && isOwner },
  );

  const createMutation = trpc.organizations.tokens.create.useMutation({
    onSuccess: () => refetch(),
  });
  const toggleMutation = trpc.organizations.tokens.toggleEnabled.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteMutation = trpc.organizations.tokens.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!orgId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[var(--color-muted)]">
          Select an organization first.
        </p>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[var(--color-muted)]">
          Only organization owners can manage API tokens.
        </p>
      </main>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !orgId) return;
    const result = await createMutation.mutateAsync({
      organizationId: orgId,
      label: label.trim(),
    });
    setNewToken(result.token);
    setLabel("");
    setCopied(false);
  }

  function handleCopy() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
    }
  }

  async function handleToggle(tokenId: string, enabled: boolean) {
    if (!orgId) return;
    await toggleMutation.mutateAsync({
      organizationId: orgId,
      tokenId,
      enabled,
    });
  }

  async function handleDelete(tokenId: string) {
    if (!orgId) return;
    await deleteMutation.mutateAsync({ organizationId: orgId, tokenId });
    setDeleteConfirm(null);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-bold">API Tokens</h1>

      {/* New token banner */}
      {newToken && (
        <div className="mb-6 rounded-xl border border-[var(--color-coral)] bg-[var(--color-surface)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--color-coral)]">
            Token created — copy it now, you won&apos;t see it again!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-[var(--color-cream)] px-3 py-2 font-mono text-sm">
              {newToken}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-[var(--color-coral)] px-3 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setNewToken(null)}
            className="mt-2 text-xs text-[var(--color-muted)] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <form
        onSubmit={handleCreate}
        className="mb-8 flex items-end gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
      >
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. CI/CD Pipeline"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
          />
        </div>
        <button
          type="submit"
          disabled={!label.trim() || createMutation.isPending}
          className="shrink-0 rounded-lg bg-[var(--color-coral)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "Create Token"}
        </button>
      </form>

      {/* Token list */}
      {tokens && tokens.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">
                  Prefix
                </th>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">
                  Label
                </th>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">
                  Created
                </th>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">
                  Last Used
                </th>
                <th className="px-4 py-3 font-medium text-[var(--color-muted)]">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {t.tokenPrefix}...
                  </td>
                  <td className="px-4 py-3">{t.label}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {t.lastUsedAt
                      ? new Date(t.lastUsedAt).toLocaleDateString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(t.id, !t.enabled)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        t.enabled
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {t.enabled ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {deleteConfirm === t.id ? (
                      <span className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-[var(--color-muted)] hover:underline"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(t.id)}
                        className="text-xs text-[var(--color-muted)] hover:text-red-500"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          No API tokens yet. Create one above to get started.
        </p>
      )}
    </main>
  );
}
