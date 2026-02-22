"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

export default function SpaceDetailPage() {
  const { spaceId } = useParams<{ spaceId: string }>();

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

  const { data, isLoading, error } = trpc.spaces.get.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );
  const { data: installedApps } = trpc.spaces.apps.listInstalled.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );
  const { data: appCatalog } = trpc.spaces.apps.catalog.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [appError, setAppError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const deleteMutation = trpc.spaces.tasks.delete.useMutation({
    onSuccess: () => {
      utils.spaces.get.invalidate({ spaceId });
      setDeleteConfirm(null);
    },
  });
  const installAppMutation = trpc.spaces.apps.install.useMutation({
    onSuccess: async () => {
      setAppError(null);
      await Promise.all([
        utils.spaces.apps.listInstalled.invalidate({ spaceId }),
        utils.spaces.apps.catalog.invalidate({ spaceId }),
        utils.spaces.get.invalidate({ spaceId }),
      ]);
    },
    onError: (err) => {
      setAppError(err.message);
    },
  });
  const uninstallAppMutation = trpc.spaces.apps.uninstall.useMutation({
    onSuccess: async () => {
      setAppError(null);
      await Promise.all([
        utils.spaces.apps.listInstalled.invalidate({ spaceId }),
        utils.spaces.apps.catalog.invalidate({ spaceId }),
      ]);
    },
    onError: (err) => {
      setAppError(err.message);
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

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <p className="text-sm text-red-600">{error.message}</p>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
      <Link
        href="/spaces"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-foreground)]"
      >
        &larr; Back to Spaces
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
              {data.name}
            </h1>
            {data.description && (
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {data.description}
              </p>
            )}
          </div>
          <Link
            href={`/spaces/${spaceId}/settings`}
            className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            Settings
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-muted)]">
          <span>
            Created by{" "}
            <strong className="text-[var(--color-foreground)]">
              {data.createdBy.name}
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
      </div>

      {/* Tasks Section */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
          Tasks
        </h2>
        {isAdminOrOwner && (
          <Link
            href={`/spaces/${spaceId}/tasks/new`}
            className="rounded-full bg-[var(--color-coral)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
          >
            New Task
          </Link>
        )}
      </div>

      {data.tasks.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Bot</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">State</th>
                {isAdminOrOwner && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-5 py-3 font-medium">
                    <Link
                      href={`/spaces/${spaceId}/tasks/${t.id}`}
                      className="transition-colors hover:text-[var(--color-coral)]"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">
                    {t.botName ?? (
                      <span className="italic text-red-400">bot unavailable</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">
                    {t.role}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block rounded-full bg-[var(--color-cream)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-muted)]">
                      {t.state}
                    </span>
                  </td>
                  {isAdminOrOwner && (
                    <td className="px-5 py-3">
                      {deleteConfirm === t.id ? (
                        <span className="flex items-center gap-2">
                          <button
                            onClick={() => deleteMutation.mutate({ taskId: t.id })}
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
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            No tasks yet.
          </p>
          {isAdminOrOwner && (
            <Link
              href={`/spaces/${spaceId}/tasks/new`}
              className="mt-3 inline-block text-sm font-medium text-[var(--color-coral)] hover:underline"
            >
              Create your first task
            </Link>
          )}
        </div>
      )}

      {/* Memory Placeholder */}
      <h2 className="mt-8 font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
        Memory
      </h2>
      <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-sm text-[var(--color-muted)]">
          Memory &mdash; coming soon
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
          Apps
        </h2>
      </div>

      {appError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {appError}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Installed
        </h3>
        {installedApps && installedApps.length > 0 ? (
          <div className="mt-3 space-y-3">
            {installedApps.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--color-border)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{item.app.name}</p>
                    {item.app.description && (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {item.app.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.app.navigation
                        .filter((nav) => isAdminOrOwner || !nav.includes("edit"))
                        .map((nav) => (
                          <span
                            key={nav}
                            className="rounded-full bg-[var(--color-cream)] px-2 py-0.5 text-xs text-[var(--color-muted)]"
                          >
                            {nav}
                          </span>
                        ))}
                    </div>
                  </div>
                  {isAdminOrOwner && (
                    <button
                      onClick={() =>
                        uninstallAppMutation.mutate({
                          spaceId,
                          appId: item.app.id,
                        })
                      }
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Uninstall
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No apps installed.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Available Apps
        </h3>
        {appCatalog && appCatalog.length > 0 ? (
          <div className="mt-3 space-y-3">
            {appCatalog.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border border-[var(--color-border)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{a.name}</p>
                    {a.description && (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">
                        {a.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.navigation
                        .filter((nav) => isAdminOrOwner || !nav.includes("edit"))
                        .map((nav) => (
                          <span
                            key={nav}
                            className="rounded-full bg-[var(--color-cream)] px-2 py-0.5 text-xs text-[var(--color-muted)]"
                          >
                            {nav}
                          </span>
                        ))}
                    </div>
                  </div>
                  {isAdminOrOwner && !a.installed && (
                    <button
                      onClick={() =>
                        installAppMutation.mutate({
                          spaceId,
                          appId: a.id,
                        })
                      }
                      disabled={!a.enabled}
                      className="rounded-full bg-[var(--color-coral)] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Install
                    </button>
                  )}
                  {a.installed && (
                    <span className="text-xs text-[var(--color-muted)]">
                      Installed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            No apps available.
          </p>
        )}
      </div>
    </main>
  );
}
