"use client";

import { useSession } from "@/lib/auth-client";
import { Hero } from "@/components/hero";
import { Dashboard } from "@/components/dashboard";

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
    </main>
  );
}
