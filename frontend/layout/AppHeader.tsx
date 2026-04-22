'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Building2, ChevronDown, LogOut, Menu, MoreHorizontal, UserRound, X } from 'lucide-react';
import { ThemeToggleButton } from '@/components/common/ThemeToggleButton';
import { useSidebar } from '@/context/SidebarContext';
import { useLogout } from '@/hooks/useAuth';
import type { Workspace, User } from '@/lib/types';

function initials(user: User) {
    const label = user.name ?? user.email;
    return label
        .split(/\s|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

export function AppHeader({
    currentWorkspace,
    title,
    user
}: {
    currentWorkspace?: Workspace | null;
    title: string;
    user: User;
}) {
    const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const { isMobileOpen, toggleMobileSidebar, toggleSidebar } = useSidebar();
    const logout = useLogout();
    const router = useRouter();
    const userButtonRef = useRef<HTMLButtonElement>(null);

    function handleToggle() {
        if (window.innerWidth >= 1024) {
            toggleSidebar();
        } else {
            toggleMobileSidebar();
        }
    }

    async function onLogout() {
        await logout.mutateAsync();
        router.push('/login');
    }

    return (
        <header className="sticky top-0 z-30 flex w-full border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:border-b">
            <div className="flex grow flex-col items-center justify-between lg:flex-row lg:px-6">
                <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
                    <button
                        aria-label="Toggle sidebar"
                        className="z-30 flex h-10 w-10 items-center justify-center rounded-lg border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400 lg:h-11 lg:w-11 lg:border"
                        onClick={handleToggle}
                        type="button"
                    >
                        {isMobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                    </button>

                    <Link
                        className="min-w-0 text-lg font-semibold text-gray-800 dark:text-white/90 lg:hidden"
                        href="/"
                    >
                        Notes
                    </Link>

                    <div className="hidden min-w-0 lg:block">
                        <p className="text-theme-xs font-medium uppercase text-gray-400">
                            Workspace
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                            <h1 className="truncate text-lg font-semibold text-gray-800 dark:text-white/90">
                                {title}
                            </h1>
                            {currentWorkspace && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-medium text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                                    <Building2 className="size-3.5" />
                                    {currentWorkspace.subdomain}
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        aria-label="Open account menu"
                        className="z-30 flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
                        onClick={() => setApplicationMenuOpen((value) => !value)}
                        type="button"
                    >
                        <MoreHorizontal className="size-5" />
                    </button>
                </div>

                <div
                    className={`${
                        isApplicationMenuOpen ? 'flex' : 'hidden'
                    } w-full items-center justify-between gap-4 px-5 py-4 shadow-theme-md dark:bg-gray-900 lg:flex lg:justify-end lg:px-0 lg:shadow-none`}
                >
                    <ThemeToggleButton />

                    <div className="relative">
                        <button
                            className="flex items-center text-gray-700 dark:text-gray-400"
                            onClick={() => setUserMenuOpen((value) => !value)}
                            ref={userButtonRef}
                            type="button"
                        >
                            <span className="mr-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                                {initials(user)}
                            </span>
                            <span className="mr-1 hidden max-w-36 truncate font-medium text-theme-sm sm:block">
                                {user.name ?? user.email}
                            </span>
                            <ChevronDown
                                className={`size-4 text-gray-500 transition-transform duration-200 dark:text-gray-400 ${
                                    isUserMenuOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </button>

                        {isUserMenuOpen && (
                            <div className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
                                <div>
                                    <span className="block truncate font-medium text-gray-700 text-theme-sm dark:text-gray-400">
                                        {user.name ?? 'Signed in user'}
                                    </span>
                                    <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                                        {user.email}
                                    </span>
                                </div>

                                <ul className="flex flex-col gap-1 border-b border-gray-200 py-3 dark:border-gray-800">
                                    <li>
                                        <Link
                                            className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                                            href="/profile"
                                            onClick={() => setUserMenuOpen(false)}
                                        >
                                            <UserRound className="size-5 text-gray-500 dark:text-gray-400" />
                                            Profile
                                        </Link>
                                    </li>
                                </ul>

                                <button
                                    className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 text-theme-sm hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
                                    disabled={logout.isPending}
                                    onClick={onLogout}
                                    type="button"
                                >
                                    <LogOut className="size-5 text-gray-500 dark:text-gray-400" />
                                    {logout.isPending ? 'Signing out' : 'Sign out'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
