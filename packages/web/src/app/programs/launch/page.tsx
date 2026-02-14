"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { programs } from "@/data/programs";

type PendingAction = "launch" | "join";

export default function LaunchPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const router = useRouter();
  const [programId, setProgramId] = useState<string | null>(null);
  const [action, setAction] = useState<PendingAction>("launch");
  const [mounted, setMounted] = useState(false);

  const launchMutation = trpc.programs.launch.useMutation({
    onSuccess: () => {
      localStorage.removeItem("pendingLaunchProgramId");
      localStorage.removeItem("pendingAction");
    },
  });

  const joinMutation = trpc.programs.join.useMutation({
    onSuccess: () => {
      localStorage.removeItem("pendingLaunchProgramId");
      localStorage.removeItem("pendingAction");
    },
  });

  const mutation = action === "join" ? joinMutation : launchMutation;

  useEffect(() => {
    setMounted(true);
    const id = localStorage.getItem("pendingLaunchProgramId");
    const pendingAction =
      (localStorage.getItem("pendingAction") as PendingAction) || "launch";
    setProgramId(id);
    setAction(pendingAction);
  }, []);

  useEffect(() => {
    if (!mounted || sessionLoading) return;
    if (!session) {
      router.replace("/programs");
      return;
    }
    if (!programId) {
      router.replace("/programs");
    }
  }, [mounted, session, sessionLoading, programId, router]);

  if (!mounted || sessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-fg)]" />
      </main>
    );
  }

  const program = programs.find((p) => p.id === programId);

  if (!session || !program) return null;

  const isJoin = action === "join";
  const successTitle = isJoin ? "Program Joined!" : "Program Launched!";
  const successMessage = isJoin ? "joined" : "launched";
  const confirmLabel = isJoin ? "Confirm Join" : "Confirm Launch";
  const pendingLabel = isJoin ? "Joining..." : "Launching...";
  const pageTitle = isJoin ? "Join Program" : "Launch Program";

  if (mutation.isSuccess) {
    return (
      <main className="pt-24">
        <section className="mx-auto max-w-lg px-6 text-center">
          <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
              {successTitle}
            </h1>
            <p className="mt-3 text-[var(--color-muted)]">
              You&apos;ve successfully {successMessage}{" "}
              <strong>{program.name}</strong>.
            </p>
            <Link
              href="/programs"
              className="mt-6 inline-block rounded-full bg-[var(--color-coral)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
            >
              Back to Programs
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pt-24">
      <section className="mx-auto max-w-lg px-6">
        <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">
            {pageTitle}
          </h1>

          <div className="mt-6 space-y-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
              {program.name}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              {program.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {program.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--color-cream)] px-3 py-1 text-xs font-medium text-[var(--color-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {mutation.error && (
            <p className="mt-4 text-sm text-red-600">
              {mutation.error.message}
            </p>
          )}

          <div className="mt-8 flex gap-3">
            <Link
              href="/programs"
              className="rounded-full border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-cream)]"
            >
              Cancel
            </Link>
            <button
              onClick={() => mutation.mutate({ programId: program.id })}
              disabled={mutation.isPending}
              className="rounded-full bg-[var(--color-coral)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)] disabled:opacity-50"
            >
              {mutation.isPending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
