'use client';

import { ReactNode } from 'react';
import { AppHeader } from '@/layout/AppHeader';
import { AppSidebar } from '@/layout/AppSidebar';
import Backdrop from '@/layout/Backdrop';
import { useSidebar } from '@/context/SidebarContext';
import type { Workspace, WorkspaceListItem, User } from '@/lib/types';

type WorkspaceItem = WorkspaceListItem & { workspace: Workspace };

export function AppShell({
    children,
    workspaces,
    currentWorkspace,
    title,
    user
}: {
    children: ReactNode;
    workspaces: WorkspaceItem[];
    currentWorkspace?: Workspace | null;
    title: string;
    user: User;
}) {
    const { isExpanded, isHovered, isMobileOpen } = useSidebar();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <AppSidebar
                workspaces={workspaces}
                currentWorkspaceId={currentWorkspace?.id ?? null}
                userId={user.userId}
            />
            <Backdrop />
            <div
                className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ease-in-out ${
                    isExpanded || isHovered ? 'lg:ml-[290px]' : 'lg:ml-[90px]'
                } ${isMobileOpen ? 'ml-0' : ''}`}
            >
                <AppHeader currentWorkspace={currentWorkspace} title={title} user={user} />
                <main className="mx-auto w-full max-w-(--breakpoint-2xl) p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
