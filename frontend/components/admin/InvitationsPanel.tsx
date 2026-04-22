'use client';

import { FormEvent, useState } from 'react';
import { Mail } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { useInviteUser, useRoles } from '@/hooks/useWorkspaceAdmin';
import type { Workspace } from '@/lib/types';

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

export function InvitationsPanel({ workspace }: { workspace: Workspace }) {
    const roles = useRoles(workspace.id);
    const invite = useInviteUser(workspace.id);
    const [roleIds, setRoleIds] = useState<string[]>([]);

    function toggleRole(roleId: string) {
        setRoleIds((current) =>
            current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]
        );
    }

    async function onInvite(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await invite.mutateAsync({
            email: String(formData.get('email') ?? ''),
            roleIds
        });
        event.currentTarget.reset();
    }

    return (
        <section className="min-h-[620px] rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Invitations</h2>
            <div className="mt-5">
                <form
                    className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                    onSubmit={onInvite}
                >
                    <input
                        className={inputClass}
                        name="email"
                        placeholder="teammate@example.com"
                        required
                        type="email"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                        {roles.data?.map((role) => (
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
                    {invite.error && (
                        <p className="mt-3 text-sm text-red-700">{displayError(invite.error)}</p>
                    )}
                    <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                        disabled={invite.isPending || !roleIds.length}
                        type="submit"
                    >
                        <Mail className="size-4" />
                        {invite.isPending ? 'Sending' : 'Send invite'}
                    </button>
                </form>

                {invite.data && (
                    <div className="mt-5 rounded-2xl border border-success-200 bg-success-50 p-4 dark:border-success-500/20 dark:bg-success-500/10">
                        <p className="text-theme-sm font-semibold text-success-700 dark:text-success-500">
                            Invitation created
                        </p>
                        <p className="mt-1 break-all font-mono text-theme-sm text-success-700 dark:text-success-500">
                            {invite.data.inviteUrl}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
