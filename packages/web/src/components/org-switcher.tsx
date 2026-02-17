"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { authClient, signOut } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";

export function OrgSwitcher({
  session,
}: {
  session: { user: { name: string; image?: string | null } };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: orgs } = trpc.organizations.myOrganizations.useQuery();
  const activeOrg = authClient.useActiveOrganization();
  const activeSession = authClient.useSession();
  const { data: members } = trpc.organizations.members.useQuery(
    { organizationId: activeOrg.data?.id! },
    { enabled: !!activeOrg.data?.id && !!activeSession.data?.user?.id },
  );
  const isOwner = members?.some(
    (m) => m.userId === activeSession.data?.user?.id && m.role === "owner",
  );
  const isAdminOrOwner = members?.some(
    (m) =>
      m.userId === activeSession.data?.user?.id &&
      (m.role === "owner" || m.role === "admin"),
  );

  // Auto-set first org as active when none is selected
  useEffect(() => {
    if (!activeOrg.data && orgs && orgs.length > 0) {
      authClient.organization.setActive({ organizationId: orgs[0].id });
    }
  }, [activeOrg.data, orgs]);

  // Click outside to close
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", onClickOutside);
      return () => document.removeEventListener("mousedown", onClickOutside);
    }
  }, [open]);

  const activeOrgName = activeOrg.data?.name ?? "Select Org";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--color-surface)]"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-coral)] text-[10px] font-bold text-white">
            {session.user.name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <span className="max-w-[120px] truncate">{activeOrgName}</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Organizations
          </div>
          {orgs?.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                authClient.organization.setActive({
                  organizationId: org.id,
                });
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-cream)] ${
                activeOrg.data?.id === org.id
                  ? "font-semibold text-[var(--color-coral)]"
                  : ""
              }`}
            >
              {org.logo ? (
                <img
                  src={org.logo}
                  alt={org.name}
                  className="h-5 w-5 rounded-full"
                />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-cream)] text-[9px] font-bold text-[var(--color-muted)]">
                  {org.name[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <span className="truncate">{org.name}</span>
              {activeOrg.data?.id === org.id && (
                <svg
                  className="ml-auto h-3.5 w-3.5 text-[var(--color-coral)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}

          <div className="my-1 border-t border-[var(--color-border)]" />

          {isAdminOrOwner && (
            <Link
              href="/settings/members"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
            >
              Members
            </Link>
          )}

          {isOwner && (
            <Link
              href="/settings/tokens"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
            >
              API Tokens
            </Link>
          )}

          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-muted)] transition-colors hover:bg-[var(--color-cream)] hover:text-[var(--color-ink)]"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
