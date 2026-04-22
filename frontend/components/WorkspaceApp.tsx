'use client';

import Link from 'next/link';
import { ReactNode, useMemo, useState } from 'react';
import {
    ArrowRight,
    Building2,
    ExternalLink,
    FileText,
    History,
    Loader2,
    MailPlus,
    Shield,
    Trash2,
    Users
} from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { DeletedNotesPanel } from '@/components/admin/DeletedNotesPanel';
import { InvitationsPanel } from '@/components/admin/InvitationsPanel';
import { MembersPanel } from '@/components/admin/MembersPanel';
import { NoteHistoryPanel } from '@/components/admin/NoteHistoryPanel';
import { RolesPanel } from '@/components/admin/RolesPanel';
import { NotesPanel } from '@/components/NotesPanel';
import { AppShell } from '@/layout/AppShell';
import { useMe } from '@/hooks/useAuth';
import { useWorkspaces, useResolveWorkspace } from '@/hooks/useWorkspaces';
import { useNotes } from '@/hooks/useNotes';
import { getTenantSubdomain, hubUrl, workspaceUrl } from '@/lib/subdomain';
import type { Workspace, WorkspaceListItem } from '@/lib/types';

type WorkspaceSection = 'notes' | 'deleted' | 'history' | 'members' | 'roles' | 'invitations';
type WorkspaceItem = WorkspaceListItem & { workspace: Workspace };

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

export function WorkspaceApp() {
    const me = useMe();
    const [tenantSubdomain] = useState(() => getTenantSubdomain());
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
    const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('notes');
    const workspaces = useWorkspaces(me.isSuccess);
    const resolved = useResolveWorkspace(tenantSubdomain, me.isSuccess && Boolean(tenantSubdomain));

    const activeWorkspaces = useMemo(
        () =>
            (workspaces.data ?? []).filter((item): item is WorkspaceItem =>
                Boolean(item.workspace)
            ),
        [workspaces.data]
    );

    const selectedWorkspace = useMemo(
        () =>
            activeWorkspaces.find((item) => item.workspace.id === selectedWorkspaceId)?.workspace ??
            activeWorkspaces[0]?.workspace ??
            null,
        [activeWorkspaces, selectedWorkspaceId]
    );

    if (me.isPending) return <FullPageState label="Loading workspace" />;

    if (me.isError) {
        return (
            <main className="grid min-h-screen place-items-center bg-gray-50 px-4 dark:bg-gray-950">
                <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                        <FileText className="size-5" />
                    </div>
                    <p className="text-theme-xs font-medium uppercase text-gray-400">
                        Encrypted Notes
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                        Sign in to continue
                    </h1>
                    <div className="mt-6 flex justify-center gap-3">
                        <Link
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                            href="/register"
                        >
                            Register
                        </Link>
                        <Link
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
                            href="/login"
                        >
                            <ArrowRight className="size-4" />
                            Sign in
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    const workspaceFromSubdomain = resolved.data?.workspace ?? null;
    const isHub = !tenantSubdomain;
    const currentWorkspace = tenantSubdomain ? workspaceFromSubdomain : null;

    return (
        <AppShell
            workspaces={activeWorkspaces}
            currentWorkspace={currentWorkspace}
            title={isHub ? 'Workspace hub' : (currentWorkspace?.name ?? 'Workspace hub')}
            user={me.data}
        >
            {isHub ? (
                <HubPanel workspaces={activeWorkspaces} />
            ) : tenantSubdomain && resolved.isError ? (
                <EmptyPanel
                    actionHref={hubUrl()}
                    actionLabel="Open hub"
                    description={displayError(resolved.error)}
                    icon={<Building2 className="size-6" />}
                    title="Workspace unavailable"
                />
            ) : currentWorkspace ? (
                <WorkspaceView
                    workspace={currentWorkspace}
                    onSectionChange={setWorkspaceSection}
                    section={workspaceSection}
                />
            ) : (
                <EmptyPanel
                    actionHref={hubUrl()}
                    actionLabel="Open hub"
                    description="Select a workspace from the hub."
                    icon={<Building2 className="size-6" />}
                    title="No workspace selected"
                />
            )}
        </AppShell>
    );
}

function WorkspaceView({
    workspace,
    onSectionChange,
    section
}: {
    workspace: Workspace;
    onSectionChange: (section: WorkspaceSection) => void;
    section: WorkspaceSection;
}) {
    const notes = useNotes(workspace.id);
    const sections: Array<{ icon: ReactNode; id: WorkspaceSection; label: string }> = [
        { id: 'notes', label: 'Notes', icon: <FileText className="size-4" /> },
        { id: 'deleted', label: 'Deleted', icon: <Trash2 className="size-4" /> },
        { id: 'history', label: 'History', icon: <History className="size-4" /> },
        { id: 'members', label: 'Members', icon: <Users className="size-4" /> },
        { id: 'roles', label: 'Roles', icon: <Shield className="size-4" /> },
        { id: 'invitations', label: 'Invitations', icon: <MailPlus className="size-4" /> }
    ];

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-theme-xs font-medium uppercase text-gray-400">
                            Current workspace
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                            {workspace.name}
                        </h2>
                        <p className="mt-1 font-mono text-theme-sm text-gray-500 dark:text-gray-400">
                            {workspace.subdomain}
                        </p>
                    </div>
                    {/* <a
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            href={workspaceUrl(workspace.subdomain)}
          >
            <ExternalLink className="size-4" />
            Open workspace
          </a> */}
                </div>
            </section>

            <nav className="rounded-2xl border border-gray-200 bg-white p-2 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-6">
                    {sections.map((item) => (
                        <button
                            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-theme-sm font-medium transition ${
                                section === item.id
                                    ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'
                            }`}
                            key={item.id}
                            onClick={() => onSectionChange(item.id)}
                            type="button"
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            </nav>

            {section === 'notes' && <NotesPanel workspace={workspace} />}
            {section === 'deleted' && <DeletedNotesPanel workspace={workspace} />}
            {section === 'history' && (
                <NoteHistoryPanel workspace={workspace} notes={notes.data ?? []} />
            )}
            {section === 'members' && <MembersPanel workspace={workspace} />}
            {section === 'roles' && <RolesPanel workspace={workspace} />}
            {section === 'invitations' && <InvitationsPanel workspace={workspace} />}
        </div>
    );
}

function HubPanel({ workspaces }: { workspaces: WorkspaceItem[] }) {
    if (workspaces.length === 0) {
        return (
            <EmptyPanel
                actionHref="/create-workspace"
                actionLabel="Create a workspace"
                description="You're not a member of any workspace yet."
                icon={<Building2 className="size-6" />}
                title="No workspaces"
            />
        );
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <p className="mb-4 text-theme-xs font-medium uppercase text-gray-400">
                Your workspaces
            </p>
            <div className="space-y-2">
                {workspaces.map(({ workspace, displayName }) => (
                    <a
                        className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/20 dark:hover:bg-brand-500/10"
                        href={workspaceUrl(workspace.subdomain)}
                        key={workspace.id}
                    >
                        <span className="flex min-w-0 items-center gap-3">
                            <Building2 className="size-4 shrink-0 text-gray-400" />
                            <span className="min-w-0">
                                <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                                    {workspace.name}
                                </span>
                                <span className="block font-mono text-theme-xs text-gray-400">
                                    {workspace.subdomain}
                                </span>
                            </span>
                        </span>
                        <span className="shrink-0 text-theme-xs text-gray-400">{displayName}</span>
                    </a>
                ))}
            </div>
        </section>
    );
}

function EmptyPanel({
    actionHref,
    actionLabel,
    description,
    icon,
    title
}: {
    actionHref?: string;
    actionLabel?: string;
    description: string;
    icon: ReactNode;
    title: string;
}) {
    return (
        <section className="grid min-h-[520px] place-items-center rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="max-w-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    {icon}
                </div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h2>
                <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">{description}</p>
                {actionHref && actionLabel && (
                    <Link
                        className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                        href={actionHref}
                    >
                        <ExternalLink className="size-4" />
                        {actionLabel}
                    </Link>
                )}
            </div>
        </section>
    );
}

function FullPageState({ label }: { label: string }) {
    return (
        <main className="grid min-h-screen place-items-center bg-gray-50 text-theme-sm font-medium text-gray-500 dark:bg-gray-950 dark:text-gray-400">
            <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {label}
            </span>
        </main>
    );
}
