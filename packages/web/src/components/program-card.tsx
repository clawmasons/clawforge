"use client";

import { useRouter } from "next/navigation";
import type { Program } from "@/data/programs";
import { signIn, useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export function ProgramCard({
  program,
  activeTags,
}: {
  program: Program;
  activeTags: string[];
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const { data: launchedPrograms } = trpc.programs.listLaunched.useQuery();
  const { data: myMemberships } = trpc.programs.myMemberships.useQuery(
    undefined,
    { enabled: !!session },
  );

  const isLaunched = launchedPrograms?.includes(program.id) ?? false;
  const myMembership = myMemberships?.find((m) => m.programId === program.id);
  const isMember = !!myMembership;

  function handleAction() {
    const action = isLaunched ? "join" : "launch";
    localStorage.setItem("pendingLaunchProgramId", program.id);
    localStorage.setItem("pendingAction", action);
    if (session) {
      router.push("/programs/launch");
    } else {
      signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/programs/launch`,
      });
    }
  }

  let buttonLabel = program.callToAction;
  let buttonDisabled = false;
  if (isLaunched && isMember) {
    buttonLabel = "Joined";
    buttonDisabled = true;
  } else if (isLaunched) {
    buttonLabel = "Join";
  }

  return (
    <div className="group flex flex-col rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-transform hover:-translate-y-0.5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {program.tags.map((tag) => (
          <span
            key={tag}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              tag === "Open"
                ? "bg-[var(--color-coral)] text-white"
                : activeTags.includes(tag)
                  ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                  : "bg-[var(--color-cream)] text-[var(--color-muted)]"
            }`}
          >
            {tag}
          </span>
        ))}
      </div>

      <h3 className="font-[family-name:var(--font-display)] text-lg font-bold leading-snug">
        {program.name}
      </h3>

      <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
        {program.description}
      </p>

      <div className="mt-6 flex items-center justify-end border-t border-[var(--color-border)] pt-4">
        <button
          onClick={handleAction}
          disabled={buttonDisabled}
          className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-cream)] disabled:opacity-50 disabled:hover:bg-transparent"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
