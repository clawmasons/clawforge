"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

function RenderedMarkdown({ content }: { content: string }) {
  // Simple markdown rendering: paragraphs, headings, bold, italic, code, lists
  // No external deps needed for basic rendering; sanitized via text content only
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    key++;
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key} className="mt-4 mb-1 text-sm font-bold">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key} className="mt-4 mb-1 text-base font-bold">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key} className="mt-4 mb-1 text-lg font-bold">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={key} className="ml-4 list-disc text-sm">
          {line.slice(2)}
        </li>,
      );
    } else if (line.startsWith("```")) {
      // Skip code fences
    } else if (line.trim() === "") {
      elements.push(<br key={key} />);
    } else {
      elements.push(
        <p key={key} className="text-sm leading-relaxed">
          {line}
        </p>,
      );
    }
  }

  return <div className="prose-sm">{elements}</div>;
}

export default function TaskDetailPage() {
  const { spaceId, taskId } = useParams<{ spaceId: string; taskId: string }>();
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

  const { data, isLoading, error } = trpc.spaces.tasks.get.useQuery(
    { taskId },
    { enabled: !!taskId },
  );

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [plan, setPlan] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setRole(data.role);
      setTriggers(data.triggers);
      setPlan(data.plan);
    }
  }, [data]);

  const utils = trpc.useUtils();
  const updateMutation = trpc.spaces.tasks.update.useMutation({
    onSuccess: () => {
      utils.spaces.tasks.get.invalidate({ taskId });
      setEditing(false);
    },
  });

  const deleteMutation = trpc.spaces.tasks.delete.useMutation({
    onSuccess: () => {
      router.push(`/spaces/${spaceId}`);
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

  function addTrigger() {
    setTriggers([...triggers, ""]);
  }

  function removeTrigger(index: number) {
    setTriggers(triggers.filter((_, i) => i !== index));
  }

  function updateTrigger(index: number, value: string) {
    const updated = [...triggers];
    updated[index] = value;
    setTriggers(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const validTriggers = triggers.filter((t) => t.trim().length > 0);
    await updateMutation.mutateAsync({
      taskId,
      name: name.trim(),
      role: role.trim(),
      triggers: validTriggers.map((t) => t.trim()),
      plan: plan.trim(),
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
      <Link
        href={`/spaces/${spaceId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-foreground)]"
      >
        &larr; Back to Space
      </Link>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            {data.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-muted)]">
            <span>
              Bot:{" "}
              {data.bot ? (
                <strong className="text-[var(--color-foreground)]">
                  {data.bot.name}
                </strong>
              ) : (
                <span className="italic text-red-400">bot unavailable</span>
              )}
            </span>
            <span>
              Role:{" "}
              <strong className="text-[var(--color-foreground)]">
                {data.role}
              </strong>
            </span>
            <span className="inline-block rounded-full bg-[var(--color-cream)] px-2.5 py-0.5 text-xs font-medium">
              {data.state}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          {isAdminOrOwner && (
            deleteConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={() => deleteMutation.mutate({ taskId })}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="text-xs text-[var(--color-muted)] hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                Delete
              </button>
            )
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Task Name
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
              Role
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Triggers
            </label>
            <div className="space-y-2">
              {triggers.map((trigger, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={trigger}
                    onChange={(e) => updateTrigger(index, e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
                  />
                  {triggers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTrigger(index)}
                      className="shrink-0 rounded-lg px-3 py-2 text-sm text-[var(--color-muted)] hover:text-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addTrigger}
              className="mt-2 text-sm font-medium text-[var(--color-coral)] hover:underline"
            >
              + Add trigger
            </button>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Plan (Markdown)
            </label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--color-coral)]"
              rows={10}
            />
          </div>

          {updateMutation.error && (
            <p className="text-sm text-red-600">{updateMutation.error.message}</p>
          )}

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-lg bg-[var(--color-coral)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>
      ) : (
        <>
          {/* Triggers */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">
              Triggers
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.triggers.map((t, i) => (
                <code
                  key={i}
                  className="rounded-lg bg-[var(--color-cream)] px-3 py-1.5 font-mono text-xs"
                >
                  {t}
                </code>
              ))}
            </div>
          </div>

          {/* Plan */}
          <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">
              Plan
            </h2>
            <RenderedMarkdown content={data.plan} />
          </div>

          {/* Timestamps */}
          <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">
              Details
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[var(--color-muted)]">Created by</dt>
                <dd className="font-medium">{data.createdBy.name}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Created</dt>
                <dd className="font-medium">
                  {new Date(data.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Updated</dt>
                <dd className="font-medium">
                  {new Date(data.updatedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Schedule</dt>
                <dd className="font-medium">{data.schedule ?? "None"}</dd>
              </div>
            </dl>
          </div>

          {/* Logs Placeholder */}
          <div className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <h2 className="mb-2 text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">
              Logs
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Logs will appear when task execution is enabled.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
