'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { useResetPassword, useResetPasswordMfa } from '@/hooks/useAuth';

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

export function ResetPasswordForm({ token }: { token: string | null }) {
    const resetPassword = useResetPassword();
    const resetPasswordMfa = useResetPasswordMfa();

    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    if (!token) {
        return (
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <KeyRound className="mx-auto mb-4 size-10 text-brand-500" />
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                        Invalid reset link
                    </h1>
                    <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                        This link is missing a reset token. Request a new one from the login page.
                    </p>
                </div>
                <Link
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white hover:bg-brand-600"
                    href="/login"
                >
                    <ArrowRight className="size-4" />
                    Back to sign in
                </Link>
            </div>
        );
    }

    if (done) {
        return (
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <ShieldCheck className="mx-auto mb-4 size-10 text-success-500" />
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                        Password updated
                    </h1>
                    <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                        Your password has been changed. You are now signed in.
                    </p>
                </div>
                <Link
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white hover:bg-brand-600"
                    href="/"
                >
                    <ArrowRight className="size-4" />
                    Go to workspace
                </Link>
            </div>
        );
    }

    async function onSubmitPassword(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (newPassword !== confirm) return;

        const result = await resetPassword.mutateAsync({ token: token!, newPassword });
        if ('requiresMfa' in result) {
            setChallengeId(result.challengeId);
        } else {
            setDone(true);
        }
    }

    async function onSubmitMfa(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await resetPasswordMfa.mutateAsync({ challengeId: challengeId!, code: mfaCode });
        setDone(true);
    }

    if (challengeId) {
        return (
            <div className="w-full max-w-md">
                <div className="mb-8">
                    <ShieldCheck className="mb-4 size-10 text-brand-500" />
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                        Confirm with MFA
                    </h1>
                    <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                        Enter your authenticator code to complete the password reset.
                    </p>
                </div>
                <form className="space-y-4" onSubmit={onSubmitMfa}>
                    <label className="block">
                        <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                            Authenticator code
                        </span>
                        <input
                            autoComplete="one-time-code"
                            autoFocus
                            className={inputClass}
                            maxLength={6}
                            onChange={(e) => setMfaCode(e.target.value)}
                            placeholder="123456"
                            required
                            value={mfaCode}
                        />
                    </label>
                    {resetPasswordMfa.error && (
                        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                            {displayError(resetPasswordMfa.error)}
                        </p>
                    )}
                    <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white hover:bg-brand-600 disabled:bg-brand-300"
                        disabled={resetPasswordMfa.isPending}
                        type="submit"
                    >
                        {resetPasswordMfa.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <ShieldCheck className="size-4" />
                        )}
                        {resetPasswordMfa.isPending ? 'Verifying' : 'Confirm reset'}
                    </button>
                </form>
            </div>
        );
    }

    const mismatch = confirm.length > 0 && newPassword !== confirm;

    return (
        <div className="w-full max-w-md">
            <div className="mb-8">
                <KeyRound className="mb-4 size-10 text-brand-500" />
                <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                    Set new password
                </h1>
                <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                    Choose a new password for your account.
                </p>
            </div>
            <form className="space-y-4" onSubmit={onSubmitPassword}>
                <label className="block">
                    <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                        New password
                    </span>
                    <input
                        autoComplete="new-password"
                        autoFocus
                        className={inputClass}
                        minLength={8}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        type="password"
                        value={newPassword}
                    />
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                        Confirm password
                    </span>
                    <input
                        autoComplete="new-password"
                        className={`${inputClass} ${mismatch ? 'border-error-400 focus:border-error-400' : ''}`}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat your password"
                        required
                        type="password"
                        value={confirm}
                    />
                    {mismatch && (
                        <span className="mt-1 block text-theme-xs text-error-600 dark:text-error-400">
                            Passwords do not match
                        </span>
                    )}
                </label>
                {resetPassword.error && (
                    <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                        {displayError(resetPassword.error)}
                    </p>
                )}
                <button
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white hover:bg-brand-600 disabled:bg-brand-300"
                    disabled={resetPassword.isPending || mismatch}
                    type="submit"
                >
                    {resetPassword.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <KeyRound className="size-4" />
                    )}
                    {resetPassword.isPending ? 'Saving' : 'Set password'}
                </button>
                <p className="text-center text-theme-sm text-gray-500 dark:text-gray-400">
                    <Link className="text-brand-500 hover:text-brand-600" href="/login">
                        Back to sign in
                    </Link>
                </p>
            </form>
        </div>
    );
}
