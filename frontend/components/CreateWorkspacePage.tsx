'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Loader2, Plus } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { AppShell } from '@/layout/AppShell';
import { useMe } from '@/hooks/useAuth';
import { useWorkspaces, useCreateWorkspace, useResolveWorkspace } from '@/hooks/useWorkspaces';
import { getTenantSubdomain, workspaceUrl } from '@/lib/subdomain';
import type { Workspace, WorkspaceListItem } from '@/lib/types';

type WorkspaceItem = WorkspaceListItem & { workspace: Workspace };

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

export function CreateWorkspacePage() {
    const me = useMe();
    const [tenantSubdomain] = useState(() => getTenantSubdomain());
    const workspaces = useWorkspaces(me.isSuccess);
    const resolved = useResolveWorkspace(tenantSubdomain, me.isSuccess && Boolean(tenantSubdomain));
    const createWorkspace = useCreateWorkspace();

    const activeWorkspaces = useMemo(
        () =>
            (workspaces.data ?? []).filter((item): item is WorkspaceItem =>
                Boolean(item.workspace)
            ),
        [workspaces.data]
    );
    const currentWorkspace = tenantSubdomain ? (resolved.data?.workspace ?? null) : null;

    const [name, setName] = useState('');
    const [subdomain, setSubdomain] = useState('');
    const [displayName, setDisplayName] = useState('');

    if (me.isPending) {
        return (
            <main className="grid min-h-screen place-items-center bg-gray-50 text-theme-sm font-medium text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Loading
                </span>
            </main>
        );
    }

    if (me.isError) {
        return (
            <main className="grid min-h-screen place-items-center bg-gray-50 px-4 dark:bg-gray-950">
                <Link
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white hover:bg-brand-600"
                    href="/login"
                >
                    Sign in to continue
                </Link>
            </main>
        );
    }

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const workspace = await createWorkspace.mutateAsync({
            name,
            ...(subdomain ? { subdomain } : {}),
            ...(displayName ? { displayName } : {})
        });
        window.location.href = workspaceUrl(workspace.subdomain);
    }

    return (
        <AppShell
            workspaces={activeWorkspaces}
            currentWorkspace={currentWorkspace}
            title="New workspace"
            user={me.data}
        >
            <div className="mx-auto max-w-lg">
                <div className="mb-6">
                    <Link
                        className="inline-flex items-center gap-2 text-theme-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        href="/"
                    >
                        <ArrowLeft className="size-4" />
                        Back to hub
                    </Link>
                </div>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="mb-6 flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                            <Building2 className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                                Create a workspace
                            </h1>
                            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                                Set up a new workspace for your team.
                            </p>
                        </div>
                    </div>

                    <form className="space-y-4" onSubmit={onSubmit}>
                        <label className="block">
                            <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                                Workspace name <span className="text-error-500">*</span>
                            </span>
                            <input
                                autoFocus
                                className={inputClass}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Acme Corp"
                                required
                                value={name}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                                Subdomain{' '}
                                <span className="font-normal text-gray-400 dark:text-gray-500">
                                    (optional — auto-generated if blank)
                                </span>
                            </span>
                            <input
                                className={inputClass}
                                onChange={(e) => setSubdomain(e.target.value)}
                                placeholder="acme"
                                value={subdomain}
                            />
                        </label>

                        <label className="block">
                            <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                                Your display name{' '}
                                <span className="font-normal text-gray-400 dark:text-gray-500">
                                    (optional)
                                </span>
                            </span>
                            <input
                                className={inputClass}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Jane Smith"
                                value={displayName}
                            />
                        </label>

                        {createWorkspace.error && (
                            <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                                {displayError(createWorkspace.error)}
                            </p>
                        )}

                        <button
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                            disabled={createWorkspace.isPending}
                            type="submit"
                        >
                            {createWorkspace.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Plus className="size-4" />
                            )}
                            {createWorkspace.isPending ? 'Creating' : 'Create workspace'}
                        </button>
                    </form>
                </section>
            </div>
        </AppShell>
    );
}
