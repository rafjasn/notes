'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, Mail, RotateCcw } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { useForgotPassword } from '@/hooks/useAuth';

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-11 pr-4 py-2.5 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

export function ForgotPasswordForm() {
    const forgotPassword = useForgotPassword();
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        await forgotPassword.mutateAsync(email);
        setSent(true);
    }

    return (
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
            <div className="mb-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <KeyRound className="size-5" />
                </div>
                <p className="text-theme-xs font-medium uppercase text-gray-400">
                    Account recovery
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                    Forgot your password?
                </h1>
            </div>

            {sent ? (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-success-200 bg-success-50 p-4 text-theme-sm text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
                        We&apos;ve sent a password reset link to{' '}
                        <span className="font-medium">{email}</span>. Check your inbox and follow
                        the link to set a new password.
                    </div>
                    <button
                        className="inline-flex w-full items-center justify-center gap-2 text-theme-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => {
                            setSent(false);
                            forgotPassword.reset();
                        }}
                        type="button"
                    >
                        <RotateCcw className="size-4" />
                        Try a different email
                    </button>
                    <p className="text-center text-theme-sm text-gray-500 dark:text-gray-400">
                        <Link
                            className="font-medium text-brand-500 hover:text-brand-600"
                            href="/login"
                        >
                            Back to sign in
                        </Link>
                    </p>
                </div>
            ) : (
                <form className="space-y-4" onSubmit={onSubmit}>
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                        Enter the email address for your account and we&apos;ll send you a reset
                        link.
                    </p>
                    <label className="block">
                        <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                            Email address
                        </span>
                        <span className="relative block">
                            <span className="absolute left-4 top-1/2 flex -translate-y-1/2 text-gray-400">
                                <Mail className="size-4" />
                            </span>
                            <input
                                autoComplete="email"
                                autoFocus
                                className={inputClass}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                type="email"
                                value={email}
                            />
                        </span>
                    </label>
                    {forgotPassword.error && (
                        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                            {displayError(forgotPassword.error)}
                        </p>
                    )}
                    <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:bg-brand-300"
                        disabled={forgotPassword.isPending}
                        type="submit"
                    >
                        {forgotPassword.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <ArrowRight className="size-4" />
                        )}
                        {forgotPassword.isPending ? 'Sending' : 'Send reset link'}
                    </button>
                    <p className="text-center text-theme-sm text-gray-500 dark:text-gray-400">
                        <Link
                            className="font-medium text-brand-500 hover:text-brand-600"
                            href="/login"
                        >
                            Back to sign in
                        </Link>
                    </p>
                </form>
            )}
        </section>
    );
}
