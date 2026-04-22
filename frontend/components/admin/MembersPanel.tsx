'use client';

import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { useMembers, useRoles, useUpdateMemberRoles } from '@/hooks/useWorkspaceAdmin';
import type { Workspace, Member, Role } from '@/lib/types';

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

function MemberRow({
    workspaceId,
    member,
    roles
}: {
    workspaceId: string;
    member: Member;
    roles: Role[];
}) {
    const updateRoles = useUpdateMemberRoles(workspaceId);
    const initialRoleIds = useMemo(() => member.roles.map((role) => role.id), [member.roles]);
    const [roleIds, setRoleIds] = useState(initialRoleIds);

    function toggleRole(roleId: string) {
        setRoleIds((current) =>
            current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]
        );
    }

    async function save() {
        await updateRoles.mutateAsync({ userId: member.userId, roleIds });
    }

    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate font-semibold text-gray-800 dark:text-white/90">
                        {member.displayName}
                    </h3>
                    <p className="truncate text-theme-sm text-gray-500 dark:text-gray-400">
                        {member.email}
                    </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-theme-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300">
                    {member.status}
                </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {roles.map((role) => (
                    <label
                        className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-theme-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
                        key={role.id}
                    >
                        <input
                            className="size-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                            checked={roleIds.includes(role.id)}
                            onChange={() => toggleRole(role.id)}
                            type="checkbox"
                        />
                        <span>{role.name}</span>
                    </label>
                ))}
            </div>
            {updateRoles.error && (
                <p className="mt-3 text-sm text-red-700">{displayError(updateRoles.error)}</p>
            )}
            <div className="mt-4 flex justify-end">
                <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                    disabled={updateRoles.isPending || !roleIds.length}
                    onClick={save}
                    type="button"
                >
                    <Save className="size-4" />
                    {updateRoles.isPending ? 'Saving' : 'Save roles'}
                </button>
            </div>
        </article>
    );
}

export function MembersPanel({ workspace }: { workspace: Workspace }) {
    const members = useMembers(workspace.id);
    const roles = useRoles(workspace.id);

    return (
        <section className="min-h-[620px] rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Members</h2>
            <div className="mt-5">
                {members.error && (
                    <p className="mt-3 text-sm text-red-700">{displayError(members.error)}</p>
                )}
                {members.isPending && (
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                        Loading members.
                    </p>
                )}
                <div className="space-y-3">
                    {members.data?.map((member) => (
                        <MemberRow
                            key={member.membershipId}
                            member={member}
                            roles={roles.data ?? []}
                            workspaceId={workspace.id}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
