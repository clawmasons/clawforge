"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

export default function NewTaskPage() {
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

  const { data: spaceData } = trpc.spaces.get.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );

  const [name, setName] = useState("");
  const [botId, setBotId] = useState("");
  const [role, setRole] = useState("");
  const [triggers, setTriggers] = useState<string[]>([""]);
  const [plan, setPlan] = useState("");

  // Get bots from the org (simple query using the bot REST endpoint isn't available via tRPC,
  // so we'll query space detail which doesn't have bots list. We need to find bots differently.
  // Since there's no trpc.bots.list, let's just let users type in a bot ID for now
  // and use the space detail which gives us org context)

  const createMutation = trpc.spaces.tasks.create.useMutation({
    onSuccess: () => {
      router.push(`/spaces/${spaceId}`);
    },
  });

  if (!isAdminOrOwner) {
    return (
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <p className="text-[var(--color-muted)]">
          Only admins and owners can create tasks.
        </p>
      </main>
    );
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validTriggers = triggers.filter((t) => t.trim().length > 0);
    if (!name.trim() || !botId.trim() || !role.trim() || validTriggers.length === 0 || !plan.trim()) {
      return;
    }
    await createMutation.mutateAsync({
      spaceId,
      name: name.trim(),
      botId: botId.trim(),
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
        &larr; Back to {spaceData?.name ?? "Space"}
      </Link>

      <h1 className="mb-8 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
        New Task
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Task Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Review Pull Requests"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            maxLength={100}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Bot ID
          </label>
          <input
            type="text"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            placeholder="Bot UUID or name"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            required
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
            placeholder="e.g. Code Reviewer"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            maxLength={100}
            required
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
                  placeholder="e.g. chat.messages.*"
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
            placeholder="Instructions for the bot when this task is triggered..."
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
            rows={8}
            required
          />
        </div>

        {createMutation.error && (
          <p className="text-sm text-red-600">{createMutation.error.message}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-[var(--color-coral)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Task"}
          </button>
          <Link
            href={`/spaces/${spaceId}`}
            className="rounded-lg px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
