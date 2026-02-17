"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

type Tab = "members" | "invitations";

export default function MembersPage() {
  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id;
  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id;

  const { data: members } = trpc.organizations.members.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );

  const currentRole = members?.find((m) => m.userId === currentUserId)?.role;
  const isAdminOrOwner = currentRole === "owner" || currentRole === "admin";

  const [tab, setTab] = useState<Tab>("members");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin" | "owner">("member");
  const [inviteStatus, setInviteStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [resendConfirm, setResendConfirm] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: invitations, refetch: refetchInvitations } = trpc.invitations.list.useQuery(
    { status: "pending" },
    { enabled: !!orgId && isAdminOrOwner },
  );

  const resendMutation = trpc.invitations.resend.useMutation({
    onSuccess: () => refetchInvitations(),
  });

  if (!orgId) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-[var(--color-muted)]">Select an organization first.</p>
      </main>
    );
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !orgId) return;
    setInviteStatus(null);

    try {
      const { error } = await authClient.organization.inviteMember({
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        organizationId: orgId,
      });
      if (error) {
        setInviteStatus({ type: "error", message: error.message ?? "Failed to send invitation." });
        return;
      }
      setInviteStatus({ type: "success", message: `Invitation sent to ${inviteEmail.trim()}.` });
      setInviteEmail("");
      refetchInvitations();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send invitation.";
      setInviteStatus({ type: "error", message });
    }
  }

  async function handleCancel(invitationId: string) {
    try {
      const { error } = await authClient.organization.cancelInvitation({ invitationId });
      setCancelConfirm(null);
      if (!error) {
        refetchInvitations();
      }
    } catch {
      // Silently fail — invitation may already be canceled
      refetchInvitations();
    }
  }

  async function handleResend(invitationId: string) {
    setResendConfirm(null);
    await resendMutation.mutateAsync({ invitationId });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-8 text-2xl font-bold">Members</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] p-1">
        <button
          onClick={() => setTab("members")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "members"
              ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Members
        </button>
        {isAdminOrOwner && (
          <button
            onClick={() => setTab("invitations")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "invitations"
                ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            }`}
          >
            Invitations
            {invitations && invitations.length > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-coral)] text-xs text-white">
                {invitations.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Members Tab */}
      {tab === "members" && (
        <>
          {members && members.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <tr>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Member</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Role</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {m.userImage ? (
                            <img
                              src={m.userImage}
                              alt=""
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream)] text-xs font-bold text-[var(--color-muted)]">
                              {m.userName?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{m.userName}</div>
                            <div className="text-xs text-[var(--color-muted)]">{m.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            m.role === "owner"
                              ? "bg-amber-100 text-amber-700"
                              : m.role === "admin"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No members yet.</p>
          )}
        </>
      )}

      {/* Invitations Tab */}
      {tab === "invitations" && isAdminOrOwner && (
        <>
          {/* Invite form */}
          <form
            onSubmit={handleInvite}
            className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                  Email address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin" | "owner")}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!inviteEmail.trim()}
                className="shrink-0 rounded-lg bg-[var(--color-coral)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                Send Invite
              </button>
            </div>
            {inviteStatus && (
              <p
                className={`mt-3 text-sm ${
                  inviteStatus.type === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {inviteStatus.message}
              </p>
            )}
          </form>

          {/* Pending invitations list */}
          {invitations && invitations.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <tr>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Email</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Role</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Invited</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Expires</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3">{inv.email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {inv.role ?? "member"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {resendConfirm === inv.id ? (
                            <span className="flex items-center gap-2">
                              <button
                                onClick={() => handleResend(inv.id)}
                                disabled={resendMutation.isPending}
                                className="text-xs font-medium text-[var(--color-coral)] hover:underline disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setResendConfirm(null)}
                                className="text-xs text-[var(--color-muted)] hover:underline"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => { setResendConfirm(inv.id); setCancelConfirm(null); }}
                              disabled={resendMutation.isPending}
                              className="text-xs text-[var(--color-coral)] hover:underline disabled:opacity-50"
                            >
                              Resend
                            </button>
                          )}
                          {cancelConfirm === inv.id ? (
                            <span className="flex items-center gap-2">
                              <button
                                onClick={() => handleCancel(inv.id)}
                                className="text-xs font-medium text-red-500 hover:underline"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setCancelConfirm(null)}
                                className="text-xs text-[var(--color-muted)] hover:underline"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => { setCancelConfirm(inv.id); setResendConfirm(null); }}
                              className="text-xs text-[var(--color-muted)] hover:text-red-500"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No pending invitations.</p>
          )}
        </>
      )}
    </main>
  );
}
