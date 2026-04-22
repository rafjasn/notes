'use client';

import { FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { useCreateRole, useRoles } from '@/hooks/useWorkspaceAdmin';
import type { Workspace } from '@/lib/types';

const KNOWN_PERMISSIONS = [
    '*',
    'workspace:delete',
    'roles:manage',
    'members:read',
    'members:invite',
    'members:manage',
    'notes:read',
    'notes:write',
    'notes:delete',
    'notes:read:deleted',
    'notes:versions:read'
];

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

export function RolesPanel({ workspace }: { workspace: Workspace }) {
    const roles = useRoles(workspace.id);
    const createRole = useCreateRole(workspace.id);
    const [permissions, setPermissions] = useState<string[]>(['notes:read']);

    function togglePermission(permission: string) {
        setPermissions((current) =>
            current.includes(permission)
                ? current.filter((item) => item !== permission)
                : [...current, permission]
        );
    }

    async function onCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await createRole.mutateAsync({
            name: String(formData.get('name') ?? ''),
            description: String(formData.get('description') ?? ''),
            permissions
        });
        event.currentTarget.reset();
        setPermissions(['notes:read']);
    }

    return (
        <section className="min-h-[620px] rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Roles</h2>
            <div className="mt-5">
                <form
                    className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
                    onSubmit={onCreate}
                >
                    <input className={inputClass} name="name" placeholder="Role name" required />
                    <input className={inputClass} name="description" placeholder="Description" />
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {KNOWN_PERMISSIONS.map((permission) => (
                            <label
                                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-theme-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
                                key={permission}
                            >
                                <input
                                    className="size-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                    checked={permissions.includes(permission)}
                                    onChange={() => togglePermission(permission)}
                                    type="checkbox"
                                />
                                <span>{permission}</span>
                            </label>
                        ))}
                    </div>
                    {createRole.error && (
                        <p className="mt-3 text-sm text-red-700">
                            {displayError(createRole.error)}
                        </p>
                    )}
                    <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                        disabled={createRole.isPending || !permissions.length}
                        type="submit"
                    >
                        <Plus className="size-4" />
                        {createRole.isPending ? 'Creating' : 'Create role'}
                    </button>
                </form>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {roles.data?.map((role) => (
                        <article
                            className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                            key={role.id}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="font-semibold text-gray-800 dark:text-white/90">
                                        {role.name}
                                    </h3>
                                    {role.description && (
                                        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                                            {role.description}
                                        </p>
                                    )}
                                </div>
                                {role.system && (
                                    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-medium text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                                        System
                                    </span>
                                )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {role.permissions.map((permission) => (
                                    <span
                                        className="rounded-full bg-gray-100 px-2.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-white/5 dark:text-gray-300"
                                        key={permission}
                                    >
                                        {permission}
                                    </span>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>
                {roles.error && (
                    <p className="mt-3 text-sm text-red-700">{displayError(roles.error)}</p>
                )}
            </div>
        </section>
    );
}
