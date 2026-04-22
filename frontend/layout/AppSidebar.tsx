'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Building2,
    Home,
    Loader2,
    LogOut,
    NotebookText,
    Plus,
    Trash2,
    UserRound
} from 'lucide-react';
import { useSidebar } from '@/context/SidebarContext';
import { useDeleteWorkspace, useLeaveWorkspace } from '@/hooks/useWorkspaces';
import { hubUrl, workspaceUrl } from '@/lib/subdomain';
import type { Workspace, WorkspaceListItem } from '@/lib/types';

type WorkspaceItem = WorkspaceListItem & { workspace: Workspace };

function isCurrent(pathname: string, path: string) {
    return pathname === path;
}

export function AppSidebar({
    workspaces,
    currentWorkspaceId,
    userId
}: {
    workspaces: WorkspaceItem[];
    currentWorkspaceId?: string | null;
    userId?: string;
}) {
    const { isExpanded, isHovered, isMobileOpen, setIsHovered } = useSidebar();
    const pathname = usePathname();
    const showText = isExpanded || isHovered || isMobileOpen;

    return (
        <aside
            className={`fixed left-0 top-0 z-50 mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900 lg:mt-0 lg:translate-x-0 ${
                isExpanded || isMobileOpen ? 'w-[290px]' : isHovered ? 'w-[290px]' : 'w-[90px]'
            } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
            onMouseEnter={() => !isExpanded && setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`flex py-8 ${showText ? 'justify-start' : 'justify-center'}`}>
                <Link className="flex items-center gap-3" href="/">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-theme-xs">
                        <NotebookText className="size-5" />
                    </span>
                    {showText && (
                        <span>
                            <span className="block text-lg font-semibold text-gray-800 dark:text-white/90">
                                Notes
                            </span>
                            <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                                Encrypted workspaces
                            </span>
                        </span>
                    )}
                </Link>
            </div>

            <nav className="no-scrollbar flex flex-1 flex-col overflow-y-auto">
                <div className="space-y-7">
                    <div>
                        <h2
                            className={`mb-4 flex text-theme-xs uppercase leading-[20px] text-gray-400 ${
                                showText ? 'justify-start' : 'justify-center'
                            }`}
                        >
                            {showText ? 'Menu' : '...'}
                        </h2>
                        <ul className="flex flex-col gap-4">
                            <li>
                                <Link
                                    className={`menu-item group ${
                                        isCurrent(pathname, '/')
                                            ? 'menu-item-active'
                                            : 'menu-item-inactive'
                                    } ${!showText ? 'lg:justify-center' : 'lg:justify-start'}`}
                                    href={hubUrl()}
                                >
                                    <Home
                                        className={
                                            isCurrent(pathname, '/')
                                                ? 'menu-item-icon-active size-5'
                                                : 'menu-item-icon-inactive size-5'
                                        }
                                    />
                                    {showText && (
                                        <span className="menu-item-text">Workspace hub</span>
                                    )}
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className={`menu-item group ${
                                        isCurrent(pathname, '/profile')
                                            ? 'menu-item-active'
                                            : 'menu-item-inactive'
                                    } ${!showText ? 'lg:justify-center' : 'lg:justify-start'}`}
                                    href="/profile"
                                >
                                    <UserRound
                                        className={
                                            isCurrent(pathname, '/profile')
                                                ? 'menu-item-icon-active size-5'
                                                : 'menu-item-icon-inactive size-5'
                                        }
                                    />
                                    {showText && <span className="menu-item-text">Profile</span>}
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h2
                            className={`mb-4 flex text-theme-xs uppercase leading-[20px] text-gray-400 ${
                                showText ? 'justify-start' : 'justify-center'
                            }`}
                        >
                            {showText ? 'Workspaces' : '...'}
                        </h2>
                        <ul className="flex flex-col gap-2">
                            {workspaces.map((item) => {
                                const active = currentWorkspaceId === item.workspace.id;
                                const isOwner = userId && item.workspace.ownerId === userId;
                                return (
                                    <li key={item.workspace.id}>
                                        <WorkspaceItem
                                            active={active}
                                            isOwner={Boolean(isOwner)}
                                            item={item}
                                            showText={showText}
                                        />
                                    </li>
                                );
                            })}
                            {!workspaces.length && showText && (
                                <li className="px-3 text-theme-sm text-gray-500 dark:text-gray-400">
                                    No workspaces yet.
                                </li>
                            )}
                            <li>
                                <Link
                                    className={`menu-item group menu-item-inactive ${!showText ? 'lg:justify-center' : 'lg:justify-start'}`}
                                    href="/create-workspace"
                                >
                                    <Plus className="menu-item-icon-inactive size-5" />
                                    {showText && (
                                        <span className="menu-item-text">New workspace</span>
                                    )}
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>
        </aside>
    );
}

function WorkspaceItem({
    active,
    isOwner,
    item,
    showText
}: {
    active: boolean;
    isOwner: boolean;
    item: WorkspaceItem;
    showText: boolean;
}) {
    const leaveWorkspace = useLeaveWorkspace();
    const deleteWorkspace = useDeleteWorkspace();
    const router = useRouter();
    const busy = leaveWorkspace.isPending || deleteWorkspace.isPending;

    async function onLeave(e: React.MouseEvent) {
        e.preventDefault();
        if (!confirm(`Leave "${item.workspace.name}"?`)) return;
        try {
            await leaveWorkspace.mutateAsync(item.workspace.id);
            if (active) router.push('/');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to leave workspace');
        }
    }

    async function onDelete(e: React.MouseEvent) {
        e.preventDefault();
        if (!confirm(`Permanently delete "${item.workspace.name}" and all its data?`)) return;
        try {
            await deleteWorkspace.mutateAsync(item.workspace.id);
            if (active) router.push('/');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to delete workspace');
        }
    }

    return (
        <div
            className={`group flex items-center gap-1 rounded-xl border px-2 py-2 ${
                active
                    ? 'border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10'
                    : 'border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-800 dark:hover:bg-white/[0.03]'
            }`}
        >
            <a
                className="flex min-w-0 flex-1 items-center gap-3"
                href={workspaceUrl(item.workspace.subdomain)}
            >
                <Building2
                    className={
                        active
                            ? 'menu-item-icon-active size-5 shrink-0'
                            : 'menu-item-icon-inactive size-5 shrink-0'
                    }
                />
                {showText && (
                    <span className="min-w-0">
                        <span className="block truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                            {item.workspace.name}
                        </span>
                        <span className="block truncate font-mono text-theme-xs text-gray-400">
                            {item.workspace.subdomain}
                        </span>
                    </span>
                )}
            </a>

            {showText && (
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {busy ? (
                        <Loader2 className="size-4 animate-spin text-gray-400" />
                    ) : (
                        <>
                            <button
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
                                onClick={onLeave}
                                title="Leave workspace"
                                type="button"
                            >
                                <LogOut className="size-3.5" />
                            </button>
                            {isOwner && (
                                <button
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-error-100 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                                    onClick={onDelete}
                                    title="Delete workspace"
                                    type="button"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
