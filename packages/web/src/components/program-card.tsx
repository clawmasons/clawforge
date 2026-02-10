import type { Program } from "@/data/programs";

export function ProgramCard({
  program,
  activeTags,
}: {
  program: Program;
  activeTags: string[];
}) {
  return (
    <div className="group flex flex-col rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-transform hover:-translate-y-0.5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {program.tags.map((tag) => (
          <span
            key={tag}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeTags.includes(tag)
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
        <button className="rounded-full border border-[var(--color-border)] px-4 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-cream)]">
          Launch Now
        </button>
      </div>
    </div>
  );
}
