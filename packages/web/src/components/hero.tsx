"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const verbs = [
  "Build Games",
  "Learn Math",
  "Write Music",
  "Design Logos",
  "Plan Vacations",
  "Train Models",
  "Analyze Data",
  "Build Robots",
  "Create Art",
  "Solve Puzzles",
  "Debug Code",
  "Forecast Weather",
  "Map Genomes",
  "Compose Songs",
  "Trade Stocks",
  "Build Websites",
  "Teach Kids",
  "Write Poetry",
  "Explore Space",
  "Master Chess",
  "Brew Beer",
  "Launch Startups",
  "Predict Markets",
  "Cook Meals",
  "Grow Gardens",
  "Automate Tasks",
  "Learn Languages",
  "Manage Finances",
  "Fantasy Football",
  "Trade Polymarket",
  "Fix Software Bugs",
  "Build Products",
  "Build Rockets",
  "Maintain Apps",
  "Cure Diseases",
  "Accelerate Science",
  "Edit Videos",
  "Animate Characters",
  "Sculpt Models",
  "Print 3D Parts",
  "Fly Drones",
  "Mix Cocktails",
  "Hack CTFs",
  "Review Code",
  "Publish Papers",
  "Stream Games",
  "Write Novels",
  "Produce Podcasts",
  "Tune Guitars",
  "Build Drones",
  "Translate Books",
  "Restore Cars",
  "Organize Events",
  "Run Campaigns",
  "Study Physics",
  "Crack Ciphers",
  "Mine Crypto",
  "Engineer Prompts",
  "Render Scenes",
  "Stitch Quilts",
  "Calibrate Telescopes",
  "Navigate Oceans",
  "Catalog Stars",
  "Sequence DNA",
  "Clone Repos",
  "Spin Records",
  "Grill Steaks",
  "Blend Smoothies",
  "Roast Coffee",
  "Paint Murals",
  "Throw Pottery",
  "Bind Books",
  "Tune Pianos",
  "Forge Swords",
  "Carve Wood",
  "Blow Glass",
  "Weave Baskets",
  "Sail Boats",
  "Climb Mountains",
  "Race Go-Karts",
  "Ride Waves",
  "Coach Teams",
  "Referee Matches",
  "Scout Talent",
  "Draft Playbooks",
  "Mint NFTs",
  "Audit Contracts",
  "Ship Features",
  "Deploy Clusters",
  "Patch Servers",
  "Scale APIs",
  "Optimize Queries",
  "Profile Apps",
  "Lint Codebases",
  "Merge Branches",
  "Squash Bugs",
  "Refactor Modules",
  "Design Systems",
  "Prototype Ideas",
  "Test Hypotheses",
  "Validate Models",
  "Curate Playlists",
  "Score Films",
  "Direct Plays",
  "Choreograph Dances",
  "Judge Competitions",
  "Host Trivia",
  "Plan Heists",
  "Solve Mysteries",
  "Chart Courses",
  "Track Wildlife",
  "Tag Butterflies",
  "Identify Mushrooms",
  "Grow Bonsai",
  "Brew Kombucha",
  "Ferment Pickles",
  "Smoke Brisket",
  "Pickle Vegetables",
  "Can Preserves",
  "Distill Spirits",
  "Age Cheese",
  "Launch Satellites",
  "Program Robots",
  "Wire Circuits",
  "Solder Boards",
  "Simulate Physics",
  "Model Weather",
  "Predict Earthquakes",
  "Map Reefs",
  "Restore Ecosystems",
  "Protect Forests",
  "Clean Oceans",
  "Plant Trees",
  "Empower Communities",
  "Advance Medicine",
  "Expand Access",
  "Bridge Divides",
  "Decode the Universe",
  "Rewrite the Rules",
  "Defy the Odds",
  "Shatter Boundaries",
  "Unlock Potential",
  "Ignite Revolutions",
  "Transcend Limits",
  "Command the Future",
  "Forge New Worlds",
  "Bend Reality",
  "Architect Tomorrow",
  "Advance Knowledge",
  "Reshape Civilization",
  "Unite the World",
  "Go to Stars",
  "Dream Bigger",
  "Improve Humanity",
];

function AnimatedVerb() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (currentIndex >= verbs.length - 1) {
      setDone(true);
      return;
    }

    const total = verbs.length;
    const runwayStart = total - 21; // last 20 verbs before final
    let delay: number;
    if (currentIndex < runwayStart) {
      // accelerate: ~325ms → ~25ms
      delay = 300 * Math.pow(1 - currentIndex / runwayStart, 3) + 25;
    } else {
      // decelerate: ease back up from ~25ms → ~500ms for dramatic buildup
      const t = (currentIndex - runwayStart) / (total - 1 - runwayStart);
      delay = 25 + 475 * Math.pow(t, 2);
    }

    const timeout = setTimeout(() => {
      setCurrentIndex((i) => i + 1);
    }, delay);

    return () => clearTimeout(timeout);
  }, [currentIndex]);

  return (
    <span
      key={currentIndex}
      className="inline-block text-[var(--color-coral)]"
      style={
        done ? undefined : { animation: "verb-swap 0.15s ease-out both" }
      }
    >
      {verbs[currentIndex]}
    </span>
  );
}

export function Hero() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-24 pb-8 text-center">
      <div className="animate-[fade-up_0.6s_ease-out_both]">
        <span className="mb-6 inline-block rounded-full border border-[var(--color-border)] px-4 py-1.5 font-[family-name:var(--font-mono)] text-xs tracking-wide text-[var(--color-muted)]">
          Powered by Openclaw
        </span>

        <h1 className="mx-auto flex flex-col items-center md:flex-row md:justify-center md:gap-x-[0.3em] font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          <span>Let&apos;s</span>
          <AnimatedVerb />
          <span>Together</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
          Where humans and claw bots build, play, and learn together.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/programs"
            className="rounded-full bg-[var(--color-coral)] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-coral-deep)]"
          >
            Browse Programs
          </Link>
          <a
            href="https://github.com/clawmasons/clawforge"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[var(--color-border)] px-7 py-3 text-sm font-semibold transition-colors hover:bg-[var(--color-surface)]"
          >
            View on GitHub
          </a>
          <a
            href="https://x.com/clawforged"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[var(--color-border)] px-7 py-3 text-sm font-semibold transition-colors hover:bg-[var(--color-surface)]"
          >
            Follow @clawforged
          </a>
        </div>

        <p className="mx-auto mt-8 max-w-lg text-xs leading-relaxed text-[var(--color-muted)]">
          Clawforge is currently in beta and makes no guarantees of availability
          or security at this point. Use at your own risk. Follow us on{" "}
          <a
            href="https://x.com/clawforged"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--color-foreground)]"
          >
            x.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}
