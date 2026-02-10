import type { Metadata } from "next";
import { ProgramsGrid } from "@/components/programs-grid";
import { programs } from "@/data/programs";

export const metadata: Metadata = {
  title: "Programs - Clawforge",
  description: "Browse open source programs built on Clawforge.",
};

export default function ProgramsPage() {
  return (
    <main className="pt-24">
      <section className="mx-auto max-w-5xl px-6">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight">
          Programs
        </h1>
        <p className="mt-3 max-w-xl text-[var(--color-muted)]">
          Explore programs built by the community.
        </p>
      </section>
      <ProgramsGrid programs={programs} filterable />
    </main>
  );
}
