'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
    ArrowRight,
    Building2,
    CheckCircle,
    Hash,
    KeyRound,
    Loader2,
    Mail,
    ShieldCheck,
    UserRound
} from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { useLogin, useMe, useRegister, useVerifyMfaChallenge } from '@/hooks/useAuth';
import { useAcceptInvitation, useInvitationPreview } from '@/hooks/useWorkspaceAdmin';

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pr-4 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

function IconInput({
    autoComplete,
    autoFocus,
    disabled,
    icon,
    label,
    maxLength,
    onChange,
    placeholder,
    required = true,
    type = 'text',
    value
}: {
    autoComplete?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    icon: React.ReactNode;
    label: string;
    maxLength?: number;
    onChange: (v: string) => void;
    placeholder?: string;
    required?: boolean;
    type?: string;
    value: string;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                {label}
            </span>
            <span className="relative block">
                <span className="absolute left-4 top-1/2 flex -translate-y-1/2 text-gray-400">
                    {icon}
                </span>
                <input
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    className={`${inputClass} pl-11`}
                    disabled={disabled}
                    maxLength={maxLength}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    type={type}
                    value={value}
                />
            </span>
        </label>
    );
}

export function InvitePage({ token }: { token: string }) {
    const me = useMe();
    const preview = useInvitationPreview(token);
    const accept = useAcceptInvitation(token);
    const login = useLogin();
    const register = useRegister();
    const verifyMfa = useVerifyMfaChallenge();

    const [tab, setTab] = useState<'login' | 'register'>('login');
    const [authStep, setAuthStep] = useState<'form' | 'mfa'>('form');
    const [challengeId, setChallengeId] = useState('');

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mfaCode, setMfaCode] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (preview.data?.email && !email) setEmail(preview.data.email);
    }, [preview.data?.email]); // eslint-disable-line react-hooks/exhaustive-deps

    async function doAccept() {
        await accept.mutateAsync({});
        setDone(true);
    }

    async function onLogin(e: FormEvent) {
        e.preventDefault();
        try {
            const data = await login.mutateAsync({ email, password });
            if ('requiresMfa' in data) {
                setChallengeId(data.challengeId);
                setAuthStep('mfa');
            } else {
                await doAccept();
            }
        } catch {
            // errors tracked in login.error / accept.error
        }
    }

    async function onMfaVerify(e: FormEvent) {
        e.preventDefault();
        try {
            await verifyMfa.mutateAsync({ challengeId, code: mfaCode });
            await doAccept();
        } catch {
            // errors tracked in verifyMfa.error / accept.error
        }
    }

    async function onRegister(e: FormEvent) {
        e.preventDefault();
        try {
            await register.mutateAsync({ name, email, password });
            await doAccept();
        } catch {
            // errors tracked in register.error / accept.error
        }
    }

    async function onAcceptDirectly(e: React.MouseEvent) {
        e.preventDefault();
        try {
            await doAccept();
        } catch {
            // error tracked in accept.error
        }
    }

    if (preview.isPending || me.isPending) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="size-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (preview.isError) {
        return (
            <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
                <div className="mb-6">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-error-50 text-error-500 dark:bg-error-500/15 dark:text-error-400">
                        <Building2 className="size-5" />
                    </div>
                    <p className="text-theme-xs font-medium uppercase text-gray-400">Invitation</p>
                    <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                        Link not valid
                    </h1>
                    <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                        This invitation link has expired or already been used. Ask the workspace
                        admin to send a new one.
                    </p>
                </div>
                <Link
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                    href="/login"
                >
                    Go to sign in
                </Link>
            </section>
        );
    }

    if (done) {
        return (
            <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
                <div className="mb-6">
                    <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-success-50 text-success-500 dark:bg-success-500/15 dark:text-success-400">
                        <CheckCircle className="size-5" />
                    </div>
                    <p className="text-theme-xs font-medium uppercase text-gray-400">All done</p>
                    <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                        You&apos;ve joined {preview.data.workspaceName}
                    </h1>
                    <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                        Head to the workspace hub to get started.
                    </p>
                </div>
                <Link
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
                    href="/"
                >
                    <ArrowRight className="size-4" />
                    Go to workspace hub
                </Link>
            </section>
        );
    }

    const { workspaceName, email: inviteEmail } = preview.data;
    const isLoggedIn = me.isSuccess;
    const emailMismatch = isLoggedIn && me.data.email.toLowerCase() !== inviteEmail.toLowerCase();

    return (
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
            <div className="mb-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <Building2 className="size-5" />
                </div>
                <p className="text-theme-xs font-medium uppercase text-gray-400">
                    You&apos;re invited
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                    Join {workspaceName}
                </h1>
                <p className="mt-2 text-theme-sm text-gray-500 dark:text-gray-400">
                    This invitation is for{' '}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                        {inviteEmail}
                    </span>
                    .
                </p>
            </div>

            {isLoggedIn ? (
                <div className="space-y-4">
                    {emailMismatch && (
                        <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-theme-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400">
                            You&apos;re signed in as{' '}
                            <span className="font-medium">{me.data.email}</span>, but this
                            invitation is for <span className="font-medium">{inviteEmail}</span>.
                            Accepting will fail unless the emails match.
                        </div>
                    )}
                    {accept.error && (
                        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                            {displayError(accept.error)}
                        </p>
                    )}
                    <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                        disabled={accept.isPending}
                        onClick={onAcceptDirectly}
                        type="button"
                    >
                        {accept.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <ArrowRight className="size-4" />
                        )}
                        {accept.isPending ? 'Joining' : 'Accept invitation'}
                    </button>
                </div>
            ) : (
                <div>
                    <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
                        {(['login', 'register'] as const).map((t) => (
                            <button
                                className={`rounded-md px-3 py-2 text-theme-sm font-medium transition ${
                                    tab === t
                                        ? 'bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white'
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }`}
                                key={t}
                                onClick={() => {
                                    setTab(t);
                                    setAuthStep('form');
                                }}
                                type="button"
                            >
                                {t === 'login' ? 'Sign in' : 'Create account'}
                            </button>
                        ))}
                    </div>

                    {tab === 'login' && authStep === 'form' && (
                        <form className="space-y-4" onSubmit={onLogin}>
                            <IconInput
                                autoComplete="email"
                                autoFocus
                                icon={<Mail className="size-4" />}
                                label="Email"
                                onChange={setEmail}
                                placeholder={inviteEmail}
                                type="email"
                                value={email}
                            />
                            <IconInput
                                autoComplete="current-password"
                                icon={<KeyRound className="size-4" />}
                                label="Password"
                                onChange={setPassword}
                                type="password"
                                value={password}
                            />
                            {(login.error || accept.error) && (
                                <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                                    {displayError(login.error ?? accept.error)}
                                </p>
                            )}
                            <button
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                                disabled={login.isPending || accept.isPending}
                                type="submit"
                            >
                                {login.isPending || accept.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="size-4" />
                                )}
                                {login.isPending
                                    ? 'Signing in'
                                    : accept.isPending
                                      ? 'Joining'
                                      : 'Sign in & join'}
                            </button>
                        </form>
                    )}

                    {tab === 'login' && authStep === 'mfa' && (
                        <form className="space-y-4" onSubmit={onMfaVerify}>
                            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-theme-sm text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                                Enter the 6-digit code from your authenticator app.
                            </div>
                            <IconInput
                                autoComplete="one-time-code"
                                autoFocus
                                icon={<ShieldCheck className="size-4" />}
                                label="Authentication code"
                                maxLength={6}
                                onChange={setMfaCode}
                                placeholder="123456"
                                value={mfaCode}
                            />
                            {(verifyMfa.error || accept.error) && (
                                <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                                    {displayError(verifyMfa.error ?? accept.error)}
                                </p>
                            )}
                            <button
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                                disabled={verifyMfa.isPending || accept.isPending}
                                type="submit"
                            >
                                {verifyMfa.isPending || accept.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <Hash className="size-4" />
                                )}
                                {verifyMfa.isPending
                                    ? 'Verifying'
                                    : accept.isPending
                                      ? 'Joining'
                                      : 'Verify & join'}
                            </button>
                        </form>
                    )}

                    {tab === 'register' && (
                        <form className="space-y-4" onSubmit={onRegister}>
                            <IconInput
                                autoComplete="name"
                                autoFocus
                                icon={<UserRound className="size-4" />}
                                label="Your name"
                                onChange={setName}
                                placeholder="Jane Smith"
                                value={name}
                            />
                            <IconInput
                                autoComplete="email"
                                icon={<Mail className="size-4" />}
                                label="Email"
                                onChange={setEmail}
                                placeholder={inviteEmail}
                                type="email"
                                value={email}
                            />
                            <IconInput
                                autoComplete="new-password"
                                icon={<KeyRound className="size-4" />}
                                label="Password"
                                onChange={setPassword}
                                type="password"
                                value={password}
                            />
                            {(register.error || accept.error) && (
                                <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                                    {displayError(register.error ?? accept.error)}
                                </p>
                            )}
                            <button
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                                disabled={register.isPending || accept.isPending}
                                type="submit"
                            >
                                {register.isPending || accept.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <ArrowRight className="size-4" />
                                )}
                                {register.isPending
                                    ? 'Creating account'
                                    : accept.isPending
                                      ? 'Joining'
                                      : 'Create account & join'}
                            </button>
                        </form>
                    )}
                </div>
            )}
        </section>
    );
}
