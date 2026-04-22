import { ThemeToggleButton } from '@/components/common/ThemeToggleButton';
import { NotebookText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative min-h-screen bg-white dark:bg-gray-900">
            <div className="relative flex min-h-screen flex-col justify-center lg:flex-row">
                <div className="flex w-full items-center justify-center px-6 py-10 lg:w-1/2">
                    {children}
                </div>

                <div className="hidden w-full items-center bg-brand-950 dark:bg-white/5 lg:grid lg:w-1/2">
                    <div className="relative z-1 flex items-center justify-center">
                        <div className="flex max-w-sm flex-col items-center px-8 text-center">
                            <Link className="mb-6 flex items-center gap-3" href="/">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-600">
                                    <NotebookText className="size-6" />
                                </span>
                                <span className="text-2xl font-semibold text-white">
                                    Encrypted Notes
                                </span>
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
                    <ThemeToggleButton />
                </div>
            </div>
        </div>
    );
}
