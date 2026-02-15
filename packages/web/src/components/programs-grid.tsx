"use client";

import { useMemo, useState } from "react";
import type { Program } from "@/data/programs";
import { ProgramCard } from "./program-card";

export function ProgramsGrid({
  programs,
  title,
  filterable,
}: {
  programs: Program[];
  title?: string;
  filterable?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Featured"]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const p of programs) {
      for (const t of p.tags) tagSet.add(t);
    }
    const sorted = Array.from(tagSet).sort();
    const idx = sorted.indexOf("Featured");
    if (idx > 0) sorted.unshift(...sorted.splice(idx, 1));
    return sorted;
  }, [programs]);

  const filtered = useMemo(() => {
    if (!filterable) return programs;

    let results = programs;

    if (selectedTags.length > 0) {
      results = results.filter((p) =>
        p.tags.some((t) => selectedTags.includes(t)),
      );
    }

    const q = search.trim().toLowerCase();
    if (q) {
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return results;
  }, [programs, selectedTags, filterable, search]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      {title && (
        <h2 className="mb-8 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          {title}
        </h2>
      )}

      {filterable && (
        <div className="mb-8 space-y-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programs..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)] focus:ring-2 focus:ring-[var(--color-fg)]/20"
          />

          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "bg-[var(--color-cream)] text-[var(--color-muted)] hover:bg-[var(--color-border)]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {filtered.map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            activeTags={filterable ? selectedTags : []}
          />
        ))}
      </div>

      {filterable && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-[var(--color-muted)]">
          No programs found.
        </p>
      )}
    </section>
  );
}
