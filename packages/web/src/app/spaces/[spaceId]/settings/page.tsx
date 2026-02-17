"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";

type SettingsTab = "general" | "members";

export default function SpaceSettingsPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const router = useRouter();

  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id;
  const { data: orgMembers } = trpc.organizations.members.useQuery(
    { organizationId: orgId! },
    { enabled: !!orgId },
  );
  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id;
  const currentOrgRole = orgMembers?.find((m) => m.userId === currentUserId)?.role;
  const isOrgAdminOrOwner = currentOrgRole === "owner" || currentOrgRole === "admin";

  const { data, isLoading } = trpc.spaces.get.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );

  const { data: spaceMembers, refetch: refetchSpaceMembers } = trpc.spaces.members.list.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );

  const currentSpaceRole = spaceMembers?.find((m) => m.userId === currentUserId)?.role;
  const isSpaceAdmin =
    isOrgAdminOrOwner ||
    currentSpaceRole === "owner" ||
    currentSpaceRole === "admin";
  const canChangeRoles =
    isOrgAdminOrOwner || currentSpaceRole === "owner";

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<"owner" | "admin" | "member">("member");
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setDescription(data.description ?? "");
    }
  }, [data]);

  const utils = trpc.useUtils();
  const updateMutation = trpc.spaces.update.useMutation({
    onSuccess: () => {
      utils.spaces.get.invalidate({ spaceId });
      utils.spaces.list.invalidate();
    },
  });

  const deleteMutation = trpc.spaces.delete.useMutation({
    onSuccess: () => {
      router.push("/spaces");
    },
  });

  const addMemberMutation = trpc.spaces.members.add.useMutation({
    onSuccess: () => {
      refetchSpaceMembers();
      setAddUserId("");
      setAddRole("member");
    },
  });

  const updateRoleMutation = trpc.spaces.members.updateRole.useMutation({
    onSuccess: () => refetchSpaceMembers(),
  });

  const removeMemberMutation = trpc.spaces.members.remove.useMutation({
    onSuccess: () => {
      refetchSpaceMembers();
      setRemoveConfirm(null);
    },
  });

  // Org members not yet in this space (for add-member dropdown)
  const availableOrgMembers = orgMembers?.filter(
    (om) => !spaceMembers?.some((sm) => sm.userId === om.userId),
  );

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-coral)]" />
        </div>
      </main>
    );
  }

  if (!data) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await updateMutation.mutateAsync({
      spaceId,
      name: name.trim(),
      description: description.trim() || null,
    });
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addUserId) return;
    await addMemberMutation.mutateAsync({
      spaceId,
      userId: addUserId,
      role: addRole,
    });
  }

  async function handleRemoveMember(userId: string) {
    await removeMemberMutation.mutateAsync({ spaceId, userId });
  }

  async function handleUpdateRole(userId: string, role: "owner" | "admin" | "member") {
    await updateRoleMutation.mutateAsync({ spaceId, userId, role });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pt-32 pb-16">
      <Link
        href={`/spaces/${spaceId}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-foreground)]"
      >
        &larr; Back to {data.name}
      </Link>

      <h1 className="mb-8 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
        Space Settings
      </h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] p-1">
        <button
          onClick={() => setSettingsTab("general")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            settingsTab === "general"
              ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setSettingsTab("members")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            settingsTab === "members"
              ? "bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-sm"
              : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          }`}
        >
          Members
          {spaceMembers && spaceMembers.length > 0 && (
            <span className="ml-2 text-xs text-[var(--color-muted)]">
              ({spaceMembers.length})
            </span>
          )}
        </button>
      </div>

      {/* General Tab */}
      {settingsTab === "general" && (
        <>
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
                maxLength={100}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
                rows={3}
                maxLength={500}
              />
            </div>

            {updateMutation.error && (
              <p className="text-sm text-red-600">{updateMutation.error.message}</p>
            )}
            {updateMutation.isSuccess && (
              <p className="text-sm text-green-600">Settings saved.</p>
            )}

            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-[var(--color-coral)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </form>

          {/* Danger Zone */}
          {isOrgAdminOrOwner && (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
              <h2 className="text-base font-bold text-red-700">Danger Zone</h2>
              <p className="mt-2 text-sm text-red-600">
                Deleting this space will permanently remove all its tasks and
                members. This action cannot be undone.
              </p>
              {deleteConfirm ? (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => deleteMutation.mutate({ spaceId })}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="text-sm text-[var(--color-muted)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  Delete Space
                </button>
              )}
              {deleteMutation.error && (
                <p className="mt-2 text-sm text-red-600">{deleteMutation.error.message}</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Members Tab */}
      {settingsTab === "members" && (
        <>
          {/* Add member form (admin+ only) */}
          {isSpaceAdmin && availableOrgMembers && availableOrgMembers.length > 0 && (
            <form
              onSubmit={handleAddMember}
              className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                    Add Organization Member
                  </label>
                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
                  >
                    <option value="">Select a member...</option>
                    {availableOrgMembers.map((om) => (
                      <option key={om.userId} value={om.userId}>
                        {om.userName} ({om.userEmail})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                    Role
                  </label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "owner" | "admin" | "member")}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-3 py-2 text-sm outline-none focus:border-[var(--color-coral)]"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={!addUserId || addMemberMutation.isPending}
                  className="shrink-0 rounded-lg bg-[var(--color-coral)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {addMemberMutation.isPending ? "Adding..." : "Add"}
                </button>
              </div>
              {addMemberMutation.error && (
                <p className="mt-3 text-sm text-red-600">{addMemberMutation.error.message}</p>
              )}
            </form>
          )}

          {/* Space members list */}
          {spaceMembers && spaceMembers.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <tr>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Member</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Role</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-muted)]">Joined</th>
                    {isSpaceAdmin && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {spaceMembers.map((sm) => (
                    <tr key={sm.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {sm.user.image ? (
                            <img src={sm.user.image} alt="" className="h-8 w-8 rounded-full" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cream)] text-xs font-bold text-[var(--color-muted)]">
                              {sm.user.name?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{sm.user.name}</div>
                            <div className="text-xs text-[var(--color-muted)]">{sm.user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {canChangeRoles ? (
                          <select
                            value={sm.role}
                            onChange={(e) =>
                              handleUpdateRole(sm.userId, e.target.value as "owner" | "admin" | "member")
                            }
                            disabled={updateRoleMutation.isPending}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-cream)] px-2 py-1 text-xs outline-none focus:border-[var(--color-coral)]"
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              sm.role === "owner"
                                ? "bg-amber-100 text-amber-700"
                                : sm.role === "admin"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {sm.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {new Date(sm.createdAt).toLocaleDateString()}
                      </td>
                      {isSpaceAdmin && (
                        <td className="px-4 py-3">
                          {/* Hide remove for owners when caller is only space admin */}
                          {!(sm.role === "owner" && !canChangeRoles) && (
                            <>
                              {removeConfirm === sm.userId ? (
                                <span className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleRemoveMember(sm.userId)}
                                    disabled={removeMemberMutation.isPending}
                                    className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setRemoveConfirm(null)}
                                    className="text-xs text-[var(--color-muted)] hover:underline"
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setRemoveConfirm(sm.userId)}
                                  className="text-xs text-[var(--color-muted)] hover:text-red-500"
                                >
                                  Remove
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No members in this space.</p>
          )}

          {updateRoleMutation.error && (
            <p className="mt-3 text-sm text-red-600">{updateRoleMutation.error.message}</p>
          )}
          {removeMemberMutation.error && (
            <p className="mt-3 text-sm text-red-600">{removeMemberMutation.error.message}</p>
          )}
        </>
      )}
    </main>
  );
}
