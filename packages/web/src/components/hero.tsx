import Link from "next/link";

export function Hero() {
  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
      <div className="animate-[fade-up_0.6s_ease-out_both]">
        <span className="mb-6 inline-block rounded-full border border-[var(--color-border)] px-4 py-1.5 font-[family-name:var(--font-mono)] text-xs tracking-wide text-[var(--color-muted)]">
          Powered by Openclaw
        </span>

        <h1 className="mx-auto max-w-3xl font-[family-name:var(--font-display)] text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Launch Programs Together
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
          Where humans and claw collaborate and build.
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
        </div>
      </div>
    </section>
  );
}
