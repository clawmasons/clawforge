"use client";

import { useSession } from "@/lib/auth-client";
import { Hero } from "@/components/hero";
import { ProgramsGrid } from "@/components/programs-grid";
import { Dashboard } from "@/components/dashboard";
import { programs } from "@/data/programs";

export default function Home() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return null;
  }

  if (session) {
    return (
      <main>
        <Dashboard />
      </main>
    );
  }

  return (
    <main>
      <Hero />
      <ProgramsGrid programs={programs} title="Featured Programs" filterable />
    </main>
  );
}
