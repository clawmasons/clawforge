import { Hero } from "@/components/hero";
import { ProgramsGrid } from "@/components/programs-grid";
import { programs } from "@/data/programs";

export default function Home() {
  return (
    <main>
      <Hero />
      <ProgramsGrid programs={programs} title="Featured Programs" />
    </main>
  );
}
