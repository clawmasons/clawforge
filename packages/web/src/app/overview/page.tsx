"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const slides = [
  {
    title: "The Problem",
    content: (
      <>
        <p className="text-xl leading-relaxed text-[var(--color-muted)] max-w-2xl">
          AI agents are the most powerful tools ever created. They can write
          code, manage infrastructure, teach students, and automate entire
          workflows.
        </p>
        <p className="mt-8 text-2xl font-bold text-[var(--color-ink)]">
          But they have zero accountability.
        </p>
        <p className="mt-6 text-lg leading-relaxed text-[var(--color-muted)] max-w-2xl">
          If your bot leaks credentials, deletes production data, or sends
          unauthorized messages&nbsp;&mdash; <strong className="text-[var(--color-ink)]">you</strong> are
          the one held responsible. Not the model. Not the framework.{" "}
          <strong className="text-[var(--color-ink)]">You.</strong>
        </p>
      </>
    ),
  },
  {
    title: "The Solution",
    content: (
      <>
        <p className="text-xl leading-relaxed text-[var(--color-muted)] max-w-2xl">
          <strong className="text-[var(--color-coral)]">Clawforge</strong> is an
          open-source orchestration layer for OpenClaw that gives you{" "}
          <strong className="text-[var(--color-ink)]">
            visibility and control
          </strong>{" "}
          over every bot you run.
        </p>
        <blockquote className="mt-10 border-l-4 border-[var(--color-coral)] pl-6 text-2xl italic text-[var(--color-ink)]">
          Define what a bot can do. Prove what it actually did. Sleep at night.
        </blockquote>
        <p className="mt-10 text-lg text-[var(--color-muted)]">
          Built by security engineers. Open source. Self-hostable.
        </p>
      </>
    ),
  },
  {
    title: "Programs",
    subtitle: "Structured Deployments",
    content: (
      <>
        <p className="text-xl leading-relaxed text-[var(--color-muted)] max-w-2xl">
          No more &ldquo;give the bot access to everything.&rdquo; A{" "}
          <strong className="text-[var(--color-ink)]">program</strong> defines
          the workflow: phases, roles, channels, and objectives.
        </p>
        <pre className="mt-8 rounded-xl bg-[var(--color-surface)] p-6 font-[family-name:var(--font-mono)] text-sm leading-relaxed text-[var(--color-ink)] overflow-x-auto">
{`Program: Learn Calculus

Roles:
  Teacher (bot)  → calculus-knowledge, solver, lesson-planner
  Student (user) → learner

Phases:
  1. Credential Bootstrap
  2. Assessment (1-on-1)
  3. Weekly Classes
  4. Final Test`}
        </pre>
        <p className="mt-6 text-lg font-semibold text-[var(--color-coral)]">
          Security is structural, not aspirational.
        </p>
      </>
    ),
  },
  {
    title: "Skillsets",
    subtitle: "Least-Privilege Containers",
    content: (
      <>
        <p className="text-xl leading-relaxed text-[var(--color-muted)] max-w-2xl">
          Each role gets a <strong className="text-[var(--color-ink)]">skillset</strong>: a
          locked-down bundle of skills, dependencies, and credentials running in
          an isolated container.
        </p>
        <pre className="mt-8 rounded-xl bg-[var(--color-surface)] p-6 font-[family-name:var(--font-mono)] text-sm leading-relaxed text-[var(--color-ink)] overflow-x-auto">
{`skillset: calculus-solver
skills:
  - solve-integral
  - solve-derivative
  - plot-function
credentials:
  - name: WOLFRAM_API_KEY
    commands: [solve-integral, solve-derivative]
    # plot-function never sees this key`}
        </pre>
        <p className="mt-6 text-lg text-[var(--color-muted)] max-w-2xl">
          Credentials are injected per-command. No global env vars. No lateral
          movement.
        </p>
      </>
    ),
  },
  {
    title: "Secure Containers",
    subtitle: "Least-Privilege Docker Isolation",
    content: (
      <>
        <p className="text-xl leading-relaxed text-[var(--color-muted)] max-w-2xl">
          Every bot runs inside a{" "}
          <strong className="text-[var(--color-ink)]">
            least-privilege Docker container
          </strong>{" "}
          built specifically for its program and role. Only the skills,
          dependencies, and credentials that role requires are included.
        </p>
        <div className="mt-8 space-y-4 max-w-2xl">
          <div className="rounded-xl bg-[var(--color-surface)] p-5">
            <p className="font-semibold text-[var(--color-ink)]">
              Role-scoped builds
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              The container installs only the skills, OS dependencies, and
              credentials the role calls for. Nothing more.
            </p>
          </div>
          <div className="rounded-xl bg-[var(--color-surface)] p-5">
            <p className="font-semibold text-[var(--color-ink)]">
              Fresh on every switch
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              When a bot switches programs or roles, it gets a brand-new
              container. Previous credentials, apps, and skills are gone.
            </p>
          </div>
          <div className="rounded-xl bg-[var(--color-surface)] p-5">
            <p className="font-semibold text-[var(--color-ink)]">
              OS-level enforcement
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              The bot can&apos;t misuse credentials it doesn&apos;t have, access apps
              outside its role, or escalate its own privileges. The container
              boundary enforces this — not prompts or policies.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    title: "Apps",
    subtitle: "Real-Time Human-Bot Collaboration",
    content: (
      <>
        <p className="text-xl leading-relaxed text-[var(--color-muted)] max-w-2xl">
          Bots and humans are{" "}
          <strong className="text-[var(--color-ink)]">peers</strong> on the same
          shared document, powered by CRDTs (Yjs). No request/response API. No
          polling. Just real-time sync.
        </p>
        <pre className="mt-8 rounded-xl bg-[var(--color-surface)] p-6 font-[family-name:var(--font-mono)] text-base leading-relaxed text-[var(--color-ink)] text-center">
{`Browser (SPA) ←→ yjs-server ←→ Clawbot
               shared Y.Doc`}
        </pre>
        <p className="mt-6 text-lg text-[var(--color-muted)] max-w-2xl">
          Streaming responses, presence tracking, and offline resilience&nbsp;&mdash;
          built in.
        </p>
      </>
    ),
  },
  {
    title: "Deploy Your Way",
    content: (
      <>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full max-w-2xl text-left text-[var(--color-muted)]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-3 pr-6 text-sm font-semibold text-[var(--color-ink)]" />
                <th className="pb-3 pr-6 text-sm font-semibold text-[var(--color-ink)]">Free</th>
                <th className="pb-3 pr-6 text-sm font-semibold text-[var(--color-ink)]">Subscription</th>
                <th className="pb-3 text-sm font-semibold text-[var(--color-ink)]">Private Cloud</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-[var(--color-border)]">
                <td className="py-4 pr-6 font-semibold text-[var(--color-ink)]">Portal</td>
                <td className="py-4 pr-6">Self-managed bots</td>
                <td className="py-4 pr-6">Hosted bots + premium</td>
                <td className="py-4">Dedicated AWS</td>
              </tr>
              <tr className="border-b border-[var(--color-border)]">
                <td className="py-4 pr-6 font-semibold text-[var(--color-ink)]">Infra</td>
                <td className="py-4 pr-6">Your hardware</td>
                <td className="py-4 pr-6">Clawforge cloud</td>
                <td className="py-4">Your AWS account</td>
              </tr>
              <tr>
                <td className="py-4 pr-6 font-semibold text-[var(--color-ink)]">Price</td>
                <td className="py-4 pr-6 text-[var(--color-coral)] font-bold">$0</td>
                <td className="py-4 pr-6">Subscription</td>
                <td className="py-4">Custom</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-8 text-lg text-[var(--color-muted)]">
          Or clone the repo and self-host everything.
        </p>
      </>
    ),
  },
  {
    title: "Get Started",
    subtitle: "3 Steps",
    content: (
      <>
        <ol className="space-y-6 text-lg text-[var(--color-muted)] max-w-2xl">
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-coral)] text-sm font-bold text-white">
              1
            </span>
            <div>
              <p className="font-semibold text-[var(--color-ink)]">
                Sign up at clawforge.org
              </p>
              <p className="mt-1 text-base">
                Create your account and organization in seconds.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-coral)] text-sm font-bold text-white">
              2
            </span>
            <div>
              <p className="font-semibold text-[var(--color-ink)]">
                Obtain your API token
              </p>
              <p className="mt-1 text-base">
                Generate a token from your dashboard under Settings &rarr; API Tokens.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-coral)] text-sm font-bold text-white">
              3
            </span>
            <div>
              <p className="font-semibold text-[var(--color-ink)]">
                Launch a program
              </p>
              <pre className="mt-2 rounded-xl bg-[var(--color-surface)] p-4 font-[family-name:var(--font-mono)] text-sm leading-relaxed text-[var(--color-ink)] overflow-x-auto">
{`npm install -g clawforge
export CLAWFORGE_TOKEN=<your token>
clawforge init
clawforge bot start --program engineering --role bug-fixer`}
              </pre>
            </div>
          </li>
        </ol>
      </>
    ),
  },
  {
    title: "Why Clawforge",
    content: (
      <>
        <ul className="space-y-5 text-xl text-[var(--color-muted)] max-w-2xl">
          <li>
            <strong className="text-[var(--color-ink)]">Open source</strong>{" "}
            &mdash; Audit every line. Fork it. Extend it.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Security-first</strong>{" "}
            &mdash; Least privilege, container isolation, scoped credentials.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Structured</strong>{" "}
            &mdash; Programs, roles, and phases replace ad-hoc bot deployments.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Real-time</strong>{" "}
            &mdash; CRDT-based collaboration, not request/response.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Portable</strong>{" "}
            &mdash; Self-host, use the cloud, or deploy to your own AWS.
          </li>
        </ul>
        <p className="mt-10 text-2xl font-bold text-[var(--color-coral)]">
          The age of unaccountable AI is over. Build with confidence.
        </p>
        <div className="mt-8 flex gap-6">
          <a
            href="https://x.com/clawforged"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
            onClick={(e) => e.stopPropagation()}
          >
            @clawforged on X
          </a>
          <a
            href="https://github.com/clawmasons/clawforge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
            onClick={(e) => e.stopPropagation()}
          >
            clawmasons/clawforge on GitHub
          </a>
        </div>
      </>
    ),
  },
];

export default function OverviewPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animating, setAnimating] = useState(false);

  const go = useCallback(
    (next: number) => {
      if (animating || next === current || next < 0 || next >= slides.length)
        return;
      setDirection(next > current ? "right" : "left");
      setAnimating(true);
      setTimeout(() => {
        setCurrent(next);
        setAnimating(false);
      }, 300);
    },
    [current, animating],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(current - 1);
      } else if (e.key === "Escape") {
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, go, router]);

  const slide = slides[current];

  const animationName = animating
    ? direction === "right"
      ? "slide-out-left"
      : "slide-out-right"
    : direction === "right"
      ? "slide-in-right"
      : "slide-in-left";

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-[var(--color-cream)]"
      onClick={() => go(current + 1)}
    >
      {/* Slide content */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-8">
        <div
          key={current}
          className="w-full max-w-3xl"
          style={{
            animation: `${animationName} 0.3s ease-out both`,
          }}
        >
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--color-ink)] md:text-6xl">
            {slide.title}
          </h1>
          {slide.subtitle && (
            <p className="mt-2 text-xl text-[var(--color-coral)] font-semibold">
              {slide.subtitle}
            </p>
          )}
          <div className="mt-8">{slide.content}</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between px-8 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow nav */}
        <div className="flex gap-2">
          <button
            onClick={() => go(current - 1)}
            disabled={current === 0}
            className="rounded-full p-2 text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous slide"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={() => go(current + 1)}
            disabled={current === slides.length - 1}
            className="rounded-full p-2 text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next slide"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 5L12.5 10L7.5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-[var(--color-coral)]"
                  : "w-2 bg-[var(--color-border)] hover:bg-[var(--color-muted)]"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Counter */}
        <span className="font-[family-name:var(--font-mono)] text-sm text-[var(--color-muted)]">
          {current + 1} / {slides.length}
        </span>
      </div>
    </div>
  );
}
