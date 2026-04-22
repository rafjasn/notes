'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
    ArrowRight,
    KeyRound,
    Loader2,
    Mail,
    Phone,
    ShieldCheck,
    ShieldOff,
    Smartphone,
    UserRound
} from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { AppShell } from '@/layout/AppShell';
import {
    useDisableMfa,
    useEnableMfa,
    useForgotPassword,
    useMe,
    useSetupMfa,
    useUpdateProfile
} from '@/hooks/useAuth';
import { useWorkspaces, useResolveWorkspace } from '@/hooks/useWorkspaces';
import { getTenantSubdomain } from '@/lib/subdomain';
import type { Workspace, WorkspaceListItem } from '@/lib/types';

type WorkspaceItem = WorkspaceListItem & { workspace: Workspace };

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

function displayError(error: unknown) {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error) return error.message;
    return 'Something went wrong';
}

function Initials({ label }: { label: string }) {
    const initials = label
        .split(/\s|@/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');

    return (
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-brand-50 text-2xl font-semibold text-brand-600 dark:border-gray-800 dark:bg-brand-500/15 dark:text-brand-400">
            {initials}
        </div>
    );
}

export function ProfilePage() {
    const me = useMe();
    const [tenantSubdomain] = useState(() => getTenantSubdomain());
    const workspaces = useWorkspaces(me.isSuccess);
    const resolved = useResolveWorkspace(tenantSubdomain, me.isSuccess && Boolean(tenantSubdomain));

    const activeWorkspaces = useMemo(
        () =>
            (workspaces.data ?? []).filter((item): item is WorkspaceItem =>
                Boolean(item.workspace)
            ),
        [workspaces.data]
    );
    const currentWorkspace = tenantSubdomain ? (resolved.data?.workspace ?? null) : null;

    if (me.isPending) {
        return (
            <main className="grid min-h-screen place-items-center bg-gray-50 text-theme-sm font-medium text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Loading profile
                </span>
            </main>
        );
    }

    if (me.isError) {
        return (
            <main className="grid min-h-screen place-items-center bg-gray-50 px-4 dark:bg-gray-950">
                <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
                    <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                        <UserRound className="size-5" />
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                        Sign in to view your profile
                    </h1>
                    <Link
                        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
                        href="/login"
                    >
                        <ArrowRight className="size-4" />
                        Sign in
                    </Link>
                </section>
            </main>
        );
    }

    return (
        <AppShell
            workspaces={activeWorkspaces}
            currentWorkspace={currentWorkspace}
            title="Profile"
            user={me.data}
        >
            <div className="space-y-6">
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-col items-center gap-6 xl:flex-row">
                            <Initials label={me.data.name ?? me.data.email} />
                            <div className="text-center xl:text-left">
                                <h1 className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                                    {me.data.name ?? 'Signed in user'}
                                </h1>
                                <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                                    {me.data.email}
                                </p>
                            </div>
                        </div>
                        <span
                            className={`inline-flex items-center justify-center gap-2 rounded-full px-3 py-1 text-theme-sm font-medium ${
                                me.data.mfaEnabled
                                    ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
                                    : 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-orange-400'
                            }`}
                        >
                            {me.data.mfaEnabled ? (
                                <ShieldCheck className="size-4" />
                            ) : (
                                <ShieldOff className="size-4" />
                            )}
                            MFA {me.data.mfaEnabled ? 'enabled' : 'disabled'}
                        </span>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                    <NameCard initialName={me.data.name ?? ''} />
                    <PhoneCard initialPhone={me.data.phone ?? ''} />
                    <ChangePasswordCard email={me.data.email} />
                    <MfaCard enabled={Boolean(me.data.mfaEnabled)} />
                </div>
            </div>
        </AppShell>
    );
}

function NameCard({ initialName }: { initialName: string }) {
    const [name, setName] = useState(initialName);
    const updateProfile = useUpdateProfile();

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await updateProfile.mutateAsync({ name });
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="mb-5 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <UserRound className="size-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                        Display name
                    </h2>
                    <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                        How your name appears across workspaces.
                    </p>
                </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
                <label className="block">
                    <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                        Name
                    </span>
                    <input
                        autoComplete="name"
                        className={inputClass}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                        value={name}
                    />
                </label>
                {updateProfile.error && (
                    <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                        {displayError(updateProfile.error)}
                    </p>
                )}
                {updateProfile.isSuccess && (
                    <p className="rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-theme-sm text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
                        Name saved.
                    </p>
                )}
                <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                    disabled={updateProfile.isPending}
                    type="submit"
                >
                    {updateProfile.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <UserRound className="size-4" />
                    )}
                    {updateProfile.isPending ? 'Saving' : 'Save name'}
                </button>
            </form>
        </section>
    );
}

function PhoneCard({ initialPhone }: { initialPhone: string }) {
    const [phone, setPhone] = useState(initialPhone);
    const updateProfile = useUpdateProfile();

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await updateProfile.mutateAsync({ phone });
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="mb-5 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <Phone className="size-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                        Phone number
                    </h2>
                    <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                        Used for SMS sign-in.
                    </p>
                </div>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
                <label className="block">
                    <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                        Phone
                    </span>
                    <span className="relative block">
                        <Smartphone className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <input
                            autoComplete="tel"
                            className={`${inputClass} pl-11`}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 555 010 1000"
                            type="tel"
                            value={phone}
                        />
                    </span>
                </label>
                {updateProfile.error && (
                    <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                        {displayError(updateProfile.error)}
                    </p>
                )}
                {updateProfile.isSuccess && (
                    <p className="rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-theme-sm text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
                        Phone number saved.
                    </p>
                )}
                <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                    disabled={updateProfile.isPending}
                    type="submit"
                >
                    {updateProfile.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Phone className="size-4" />
                    )}
                    {updateProfile.isPending ? 'Saving' : 'Save phone'}
                </button>
            </form>
        </section>
    );
}

function ChangePasswordCard({ email }: { email: string }) {
    const forgotPassword = useForgotPassword();

    async function onSend() {
        await forgotPassword.mutateAsync(email);
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="mb-5 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <KeyRound className="size-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                        Password
                    </h2>
                    <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                        A reset link will be sent to <span className="font-medium">{email}</span>.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {forgotPassword.isSuccess ? (
                    <div className="rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-theme-sm text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
                        Reset link sent — check your inbox.
                    </div>
                ) : (
                    <>
                        {forgotPassword.error && (
                            <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                                {displayError(forgotPassword.error)}
                            </p>
                        )}
                        <button
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                            disabled={forgotPassword.isPending}
                            onClick={onSend}
                            type="button"
                        >
                            {forgotPassword.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Mail className="size-4" />
                            )}
                            {forgotPassword.isPending ? 'Sending' : 'Send reset link'}
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}

function MfaCard({ enabled }: { enabled: boolean }) {
    const setupMfa = useSetupMfa();
    const enableMfa = useEnableMfa();
    const disableMfa = useDisableMfa();
    const [code, setCode] = useState('');
    const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);

    async function onSetup() {
        const result = await setupMfa.mutateAsync();
        setSetup(result);
    }

    async function onEnable(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await enableMfa.mutateAsync(code);
        setCode('');
        setSetup(null);
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="mb-5 flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <ShieldCheck className="size-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                        Multi-factor authentication
                    </h2>
                    <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
                        Add an authenticator app code to protect account sign-in.
                    </p>
                </div>
            </div>

            {enabled ? (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-success-200 bg-success-50 p-4 text-theme-sm text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
                        MFA is enabled for this account.
                    </div>
                    {disableMfa.error && (
                        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                            {displayError(disableMfa.error)}
                        </p>
                    )}
                    <button
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-error-300 bg-white px-4 py-3 text-theme-sm font-medium text-error-600 shadow-theme-xs hover:bg-error-50 disabled:opacity-60 dark:border-error-500/30 dark:bg-gray-900 dark:text-error-400 dark:hover:bg-error-500/10"
                        disabled={disableMfa.isPending}
                        onClick={() => disableMfa.mutate()}
                        type="button"
                    >
                        {disableMfa.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <ShieldOff className="size-4" />
                        )}
                        {disableMfa.isPending ? 'Disabling' : 'Disable MFA'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {!setup && (
                        <button
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                            disabled={setupMfa.isPending}
                            onClick={onSetup}
                            type="button"
                        >
                            {setupMfa.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <KeyRound className="size-4" />
                            )}
                            {setupMfa.isPending ? 'Preparing' : 'Set up MFA'}
                        </button>
                    )}

                    {setupMfa.error && (
                        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                            {displayError(setupMfa.error)}
                        </p>
                    )}

                    {setup && (
                        <form className="space-y-4" onSubmit={onEnable}>
                            <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                                <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                                    Authenticator secret
                                </p>
                                <p className="break-all font-mono text-theme-sm text-gray-600 dark:text-gray-300">
                                    {setup.secret}
                                </p>
                                <p className="break-all font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                                    {setup.uri}
                                </p>
                            </div>
                            <label className="block">
                                <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                                    Verification code
                                </span>
                                <input
                                    autoComplete="one-time-code"
                                    className={inputClass}
                                    maxLength={6}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder="123456"
                                    required
                                    value={code}
                                />
                            </label>
                            {enableMfa.error && (
                                <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                                    {displayError(enableMfa.error)}
                                </p>
                            )}
                            <button
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                                disabled={enableMfa.isPending}
                                type="submit"
                            >
                                {enableMfa.isPending ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <ShieldCheck className="size-4" />
                                )}
                                {enableMfa.isPending ? 'Enabling' : 'Enable MFA'}
                            </button>
                        </form>
                    )}
                </div>
            )}
        </section>
    );
}
