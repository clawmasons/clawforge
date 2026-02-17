"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

export default function InviteAcceptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = authClient.useSession();
  const [status, setStatus] = useState<
    "loading" | "ready" | "accepting" | "error" | "expired" | "canceled" | "accepted"
  >("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: invite, isLoading, error: fetchError } = trpc.invitations.get.useQuery(
    { id },
    { enabled: !!id, retry: false },
  );

  const isAuthenticated = !!session.data?.user;
  const userEmail = session.data?.user?.email?.toLowerCase();

  useEffect(() => {
    if (isLoading || !invite) return;

    if (invite.status === "expired") {
      setStatus("expired");
      return;
    }
    if (invite.status === "canceled") {
      setStatus("canceled");
      return;
    }
    if (invite.status === "accepted") {
      setStatus("accepted");
      return;
    }

    if (isAuthenticated && invite.status === "pending") {
      const inviteEmail = invite.email.toLowerCase();
      if (userEmail === inviteEmail) {
        setStatus("ready");
      } else {
        setStatus("error");
        setErrorMsg(
          `This invitation was sent to ${invite.email}. You are signed in as ${session.data?.user?.email}. Please sign in with the correct account.`,
        );
      }
    } else if (!isAuthenticated) {
      setStatus("ready");
    }
  }, [invite, isLoading, isAuthenticated, userEmail, session.data?.user?.email]);

  async function handleAccept() {
    if (!invite) return;
    setStatus("accepting");
    try {
      await authClient.organization.acceptInvitation({ invitationId: invite.id });
      router.push("/spaces");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to accept invitation.");
    }
  }

  function handleSignIn() {
    authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/invite/${id}`,
    });
  }

  function handleSignInDifferent() {
    authClient.signOut().then(() => {
      authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}/invite/${id}`,
      });
    });
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-coral)]" />
      </main>
    );
  }

  if (fetchError || !invite) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-4 text-2xl font-bold">Invitation Not Found</h1>
          <p className="text-[var(--color-muted)]">
            This invitation link is invalid or has already been used.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        {invite.organization.logo && (
          <img
            src={invite.organization.logo}
            alt={invite.organization.name}
            className="mx-auto mb-4 h-16 w-16 rounded-full"
          />
        )}
        <h1 className="mb-2 text-2xl font-bold">
          Join {invite.organization.name}
        </h1>

        {status === "expired" && (
          <>
            <p className="mb-4 text-[var(--color-muted)]">
              This invitation has expired.
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Please contact your organization admin to request a new invitation.
            </p>
          </>
        )}

        {status === "canceled" && (
          <p className="mb-4 text-[var(--color-muted)]">
            This invitation has been canceled.
          </p>
        )}

        {status === "accepted" && (
          <>
            <p className="mb-4 text-[var(--color-muted)]">
              This invitation has already been accepted.
            </p>
            <button
              onClick={() => router.push("/spaces")}
              className="mt-2 rounded-lg bg-[var(--color-coral)] px-6 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {(status === "ready" || status === "accepting") && (
          <>
            <p className="mb-6 text-[var(--color-muted)]">
              You&apos;ve been invited to join as{" "}
              <span className="font-semibold text-[var(--color-foreground)]">
                {invite.role ?? "member"}
              </span>
              .
            </p>

            {!isAuthenticated ? (
              <button
                onClick={handleSignIn}
                className="w-full rounded-lg bg-[var(--color-coral)] px-6 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Sign in with Google to Accept
              </button>
            ) : (
              <button
                onClick={handleAccept}
                disabled={status === "accepting"}
                className="w-full rounded-lg bg-[var(--color-coral)] px-6 py-3 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {status === "accepting" ? "Accepting..." : "Accept Invitation"}
              </button>
            )}
          </>
        )}

        {status === "error" && (
          <>
            <p className="mb-4 text-sm text-red-600">{errorMsg}</p>
            <button
              onClick={handleSignInDifferent}
              className="rounded-lg border border-[var(--color-border)] px-6 py-2 text-sm font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-cream)]"
            >
              Sign in with a Different Account
            </button>
          </>
        )}

        {status === "loading" && (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-coral)]" />
          </div>
        )}
      </div>
    </main>
  );
}
