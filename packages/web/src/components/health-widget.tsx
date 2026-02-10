"use client";

import { useState, useEffect } from "react";

type HealthStatus = "checking" | "healthy" | "unhealthy";

function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

export function HealthWidget() {
  const [status, setStatus] = useState<HealthStatus>("checking");

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${getApiUrl()}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!mounted) return;
        const data = await res.json();
        setStatus(data.status === "ok" ? "healthy" : "unhealthy");
      } catch {
        if (mounted) setStatus("unhealthy");
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const color = {
    checking: "bg-yellow-400",
    healthy: "bg-green-500",
    unhealthy: "bg-red-500",
  }[status];

  const label = {
    checking: "Checking API…",
    healthy: "API Connected",
    unhealthy: "API Unreachable",
  }[status];

  return (
    <div className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-3 py-1.5 text-xs backdrop-blur-md">
      <span
        className={`inline-block h-2 w-2 rounded-full ${color} ${status === "healthy" ? "animate-pulse" : ""}`}
      />
      <span className="text-[var(--color-muted)]">{label}</span>
    </div>
  );
}
