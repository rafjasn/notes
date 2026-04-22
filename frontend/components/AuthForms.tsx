'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, ReactNode, useMemo, useState } from 'react';
import {
    ArrowRight,
    Globe,
    Hash,
    KeyRound,
    Link2,
    Loader2,
    Mail,
    RotateCcw,
    ShieldCheck,
    Smartphone,
    UserRound
} from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import {
    useInitiateEmailOtp,
    useInitiateMagicLink,
    useInitiateSmsOtp,
    useLogin,
    useRegister,
    useVerifyEmailOtp,
    useVerifyMfaChallenge,
    useVerifySmsOtp
} from '@/hooks/useAuth';
import { getTenantSubdomain } from '@/lib/subdomain';

type AuthMethod = 'choice' | 'email-code' | 'email-link' | 'password' | 'sms';
type Step = 'idle' | 'otp-sent' | 'magic-link-sent' | 'mfa-required';

function mutationError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

function useWorkspaceSubdomain() {
    return useMemo(() => getTenantSubdomain(), []);
}

function MfaChallenge({ challengeId, onBack }: { challengeId: string; onBack: () => void }) {
    const router = useRouter();
    const verify = useVerifyMfaChallenge();
    const [code, setCode] = useState('');

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        await verify.mutateAsync({ challengeId, code });
        router.push('/');
    }

    return (
        <form className="space-y-5" onSubmit={onSubmit}>
            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-theme-sm text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                Enter the 6-digit code from your authenticator app.
            </div>
            <LabeledInput
                autoComplete="one-time-code"
                icon={<Hash className="size-4" />}
                label="Authentication code"
                maxLength={6}
                onChange={setCode}
                value={code}
            />
            {verify.error && <ErrorText error={verify.error} />}
            <PrimaryButton label="Verify" pending={verify.isPending} pendingLabel="Verifying" />
            <button
                className="flex w-full items-center justify-center gap-2 text-theme-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={onBack}
                type="button"
            >
                <RotateCcw className="size-4" />
                Back
            </button>
        </form>
    );
}

export function LoginForm({
    initialMfaChallengeId,
    initialUrlError
}: {
    initialMfaChallengeId?: string | null;
    initialUrlError?: string | null;
}) {
    const router = useRouter();
    const workspaceSubdomain = useWorkspaceSubdomain();
    const [method, setMethod] = useState<AuthMethod>('choice');
    const [step, setStep] = useState<Step>(initialMfaChallengeId ? 'mfa-required' : 'idle');
    const [challengeId, setChallengeId] = useState(initialMfaChallengeId ?? '');
    const [googleError, setGoogleError] = useState('');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');

    const login = useLogin();
    const initiateEmailOtp = useInitiateEmailOtp();
    const verifyEmailOtp = useVerifyEmailOtp();
    const initiateMagicLink = useInitiateMagicLink();
    const initiateSmsOtp = useInitiateSmsOtp();
    const verifySmsOtp = useVerifySmsOtp();

    function handleMfaResponse(data: unknown) {
        if (!data || typeof data !== 'object') return false;

        const response = data as Record<string, unknown>;
        if (response.requiresMfa === true && typeof response.challengeId === 'string') {
            setChallengeId(response.challengeId);
            setStep('mfa-required');
            return true;
        }
        return false;
    }

    async function onPasswordSubmit(e: FormEvent) {
        e.preventDefault();
        const data = await login.mutateAsync({ email, password, workspaceSubdomain });
        if (!handleMfaResponse(data)) router.push('/');
    }

    async function onEmailOtpInitiate(e: FormEvent) {
        e.preventDefault();
        const data = await initiateEmailOtp.mutateAsync({ email, workspaceSubdomain });
        setChallengeId(data.challengeId);
        setStep('otp-sent');
        setCode('');
    }

    async function onEmailOtpVerify(e: FormEvent) {
        e.preventDefault();
        const data = await verifyEmailOtp.mutateAsync({ challengeId, code });
        if (!handleMfaResponse(data)) router.push('/');
    }

    async function onMagicLinkSubmit(e: FormEvent) {
        e.preventDefault();
        await initiateMagicLink.mutateAsync({ email, workspaceSubdomain });
        setStep('magic-link-sent');
    }

    async function onSmsOtpInitiate(e: FormEvent) {
        e.preventDefault();
        const data = await initiateSmsOtp.mutateAsync({ phone, workspaceSubdomain });
        setChallengeId(data.challengeId);
        setStep('otp-sent');
        setCode('');
    }

    async function onSmsOtpVerify(e: FormEvent) {
        e.preventDefault();
        const data = await verifySmsOtp.mutateAsync({ challengeId, code });
        if (!handleMfaResponse(data)) router.push('/');
    }

    async function onGoogleSignIn() {
        setGoogleError('');
        const res = await fetch('/api/bff/auth/oauth/url');
        if (!res.ok) {
            setGoogleError('Google sign-in is not available right now.');
            return;
        }
        const { url } = (await res.json()) as { url?: string };
        if (url) window.location.href = url;
    }

    function resetStep() {
        setStep('idle');
        setCode('');
        setChallengeId('');
        setGoogleError('');
    }

    function chooseMethod(nextMethod: AuthMethod) {
        setMethod(nextMethod);
        resetStep();
    }

    function reset() {
        setMethod('choice');
        resetStep();
    }

    if (step === 'mfa-required') {
        return (
            <AuthPanel
                eyebrow="Secure sign in"
                icon={<ShieldCheck className="size-5" />}
                title="Two-factor authentication"
            >
                <MfaChallenge challengeId={challengeId} onBack={reset} />
            </AuthPanel>
        );
    }

    return (
        <AuthPanel eyebrow="Welcome back" icon={<KeyRound className="size-5" />} title="Sign in">
            {initialUrlError && (
                <div className="mb-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
                    {initialUrlError}
                </div>
            )}

            {method === 'choice' && (
                <div className="space-y-3">
                    <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
                        onClick={onGoogleSignIn}
                        type="button"
                    >
                        <Globe className="size-4" />
                        Sign in with Google
                    </button>
                    {googleError && <ErrorText error={googleError} />}

                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                        </div>
                        <div className="relative flex justify-center text-theme-xs">
                            <span className="bg-white px-3 text-gray-400 dark:bg-gray-900">or</span>
                        </div>
                    </div>

                    <MethodButton
                        description="Get a sign-in link in your inbox."
                        icon={<Mail className="size-4" />}
                        label="Login with email"
                        onClick={() => chooseMethod('email-link')}
                    />
                    <MethodButton
                        description="Use your email and password."
                        icon={<KeyRound className="size-4" />}
                        label="Login with password"
                        onClick={() => chooseMethod('password')}
                    />
                    <MethodButton
                        description="Receive a one-time code by SMS."
                        icon={<Smartphone className="size-4" />}
                        label="Login with text"
                        onClick={() => chooseMethod('sms')}
                    />
                </div>
            )}

            {method === 'email-link' && step === 'idle' && (
                <form className="space-y-4" onSubmit={onMagicLinkSubmit}>
                    <p className="rounded-2xl border border-brand-100 bg-brand-50 p-4 text-theme-sm text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                        If an account exists for this email, we will send a magic link to sign in.
                    </p>
                    <LabeledInput
                        autoComplete="email"
                        icon={<Mail className="size-4" />}
                        label="Email"
                        onChange={setEmail}
                        type="email"
                        value={email}
                    />
                    {initiateMagicLink.error && <ErrorText error={initiateMagicLink.error} />}
                    <PrimaryButton
                        label="Send magic link"
                        pending={initiateMagicLink.isPending}
                        pendingLabel="Sending"
                    />
                    <button
                        className="inline-flex w-full items-center justify-center gap-2 text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                        onClick={() => chooseMethod('email-code')}
                        type="button"
                    >
                        <Hash className="size-4" />
                        Login with code instead
                    </button>
                    <BackButton onClick={reset} />
                </form>
            )}

            {method === 'email-link' && step === 'magic-link-sent' && (
                <div className="space-y-4 rounded-2xl border border-success-200 bg-success-50 p-4 text-theme-sm text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
                    If an account exists for <span className="font-medium">{email}</span>, we sent a
                    magic link.
                    <button
                        className="inline-flex w-full items-center justify-center gap-2 text-theme-sm font-medium text-success-700 hover:text-success-800 dark:text-success-400"
                        onClick={() => chooseMethod('email-code')}
                        type="button"
                    >
                        <Hash className="size-4" />
                        Login with code instead
                    </button>
                    <ResendButton onClick={() => setStep('idle')} />
                </div>
            )}

            {method === 'email-code' && step === 'idle' && (
                <form className="space-y-4" onSubmit={onEmailOtpInitiate}>
                    <p className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-theme-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                        We will email you a one-time code.
                    </p>
                    <LabeledInput
                        autoComplete="email"
                        icon={<Mail className="size-4" />}
                        label="Email"
                        onChange={setEmail}
                        type="email"
                        value={email}
                    />
                    {initiateEmailOtp.error && <ErrorText error={initiateEmailOtp.error} />}
                    <PrimaryButton
                        label="Send code"
                        pending={initiateEmailOtp.isPending}
                        pendingLabel="Sending"
                    />
                    <button
                        className="inline-flex w-full items-center justify-center gap-2 text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                        onClick={() => chooseMethod('email-link')}
                        type="button"
                    >
                        <Link2 className="size-4" />
                        Use magic link instead
                    </button>
                    <BackButton onClick={reset} />
                </form>
            )}

            {method === 'email-code' && step === 'otp-sent' && (
                <form className="space-y-4" onSubmit={onEmailOtpVerify}>
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                        Enter the 6-digit code sent to {email}.
                    </p>
                    <LabeledInput
                        autoComplete="one-time-code"
                        icon={<Hash className="size-4" />}
                        label="Code"
                        maxLength={6}
                        onChange={setCode}
                        value={code}
                    />
                    {verifyEmailOtp.error && <ErrorText error={verifyEmailOtp.error} />}
                    <PrimaryButton
                        label="Verify"
                        pending={verifyEmailOtp.isPending}
                        pendingLabel="Verifying"
                    />
                    <ResendButton onClick={() => setStep('idle')} />
                </form>
            )}

            {method === 'password' && (
                <>
                    <form className="space-y-4" onSubmit={onPasswordSubmit}>
                        <LabeledInput
                            autoComplete="email"
                            icon={<Mail className="size-4" />}
                            label="Email"
                            onChange={setEmail}
                            type="email"
                            value={email}
                        />
                        <LabeledInput
                            autoComplete="current-password"
                            icon={<KeyRound className="size-4" />}
                            label="Password"
                            onChange={setPassword}
                            type="password"
                            value={password}
                        />
                        {login.error && <ErrorText error={login.error} />}
                        <PrimaryButton
                            label="Sign in"
                            pending={login.isPending}
                            pendingLabel="Signing in"
                        />
                        <BackButton onClick={reset} />
                    </form>
                    <div className="mt-2 flex justify-end">
                        <Link
                            className="text-theme-xs font-medium text-brand-500 hover:text-brand-600"
                            href="/forgot-password"
                        >
                            Forgot password?
                        </Link>
                    </div>
                </>
            )}

            {method === 'sms' && step === 'idle' && (
                <form className="space-y-4" onSubmit={onSmsOtpInitiate}>
                    <LabeledInput
                        autoComplete="tel"
                        icon={<Smartphone className="size-4" />}
                        label="Phone number"
                        onChange={setPhone}
                        type="tel"
                        value={phone}
                    />
                    {initiateSmsOtp.error && <ErrorText error={initiateSmsOtp.error} />}
                    <PrimaryButton
                        label="Send code"
                        pending={initiateSmsOtp.isPending}
                        pendingLabel="Sending"
                    />
                    <BackButton onClick={reset} />
                </form>
            )}

            {method === 'sms' && step === 'otp-sent' && (
                <form className="space-y-4" onSubmit={onSmsOtpVerify}>
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                        Enter the 6-digit code sent to {phone}.
                    </p>
                    <LabeledInput
                        autoComplete="one-time-code"
                        icon={<Hash className="size-4" />}
                        label="Code"
                        maxLength={6}
                        onChange={setCode}
                        value={code}
                    />
                    {verifySmsOtp.error && <ErrorText error={verifySmsOtp.error} />}
                    <PrimaryButton
                        label="Verify"
                        pending={verifySmsOtp.isPending}
                        pendingLabel="Verifying"
                    />
                    <ResendButton onClick={() => setStep('idle')} />
                </form>
            )}

            <p className="mt-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                Need an account?{' '}
                <Link className="font-medium text-brand-500 hover:text-brand-600" href="/register">
                    Create one
                </Link>
            </p>
        </AuthPanel>
    );
}

export function RegisterForm() {
    const router = useRouter();
    const register = useRegister();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await register.mutateAsync({ name, email, password });
        router.push('/');
    }

    return (
        <AuthPanel
            eyebrow="Start your workspace"
            icon={<UserRound className="size-5" />}
            title="Create account"
        >
            <form className="space-y-4" onSubmit={onSubmit}>
                <LabeledInput
                    autoComplete="name"
                    icon={<UserRound className="size-4" />}
                    label="Name"
                    onChange={setName}
                    value={name}
                />
                <LabeledInput
                    autoComplete="email"
                    icon={<Mail className="size-4" />}
                    label="Email"
                    onChange={setEmail}
                    type="email"
                    value={email}
                />
                <LabeledInput
                    autoComplete="new-password"
                    icon={<KeyRound className="size-4" />}
                    label="Password"
                    onChange={setPassword}
                    type="password"
                    value={password}
                />
                {register.error && <ErrorText error={register.error} />}
                <PrimaryButton
                    label="Create account"
                    pending={register.isPending}
                    pendingLabel="Creating account"
                />
            </form>
            <p className="mt-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                Already have an account?{' '}
                <Link className="font-medium text-brand-500 hover:text-brand-600" href="/login">
                    Sign in
                </Link>
            </p>
        </AuthPanel>
    );
}

function MethodButton({
    description,
    icon,
    label,
    onClick
}: {
    description: string;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/20 dark:hover:bg-brand-500/10"
            onClick={onClick}
            type="button"
        >
            <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500 shadow-theme-xs dark:bg-white/5">
                    {icon}
                </span>
                <span className="min-w-0">
                    <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">
                        {label}
                    </span>
                    <span className="block truncate text-theme-xs text-gray-500 dark:text-gray-400">
                        {description}
                    </span>
                </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-gray-400" />
        </button>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            className="inline-flex w-full items-center justify-center gap-2 text-theme-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onClick}
            type="button"
        >
            <RotateCcw className="size-4" />
            Back to sign-in options
        </button>
    );
}

function AuthPanel({
    children,
    eyebrow,
    icon,
    title
}: {
    children: ReactNode;
    eyebrow: string;
    icon: ReactNode;
    title: string;
}) {
    return (
        <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] sm:p-8">
            <div className="mb-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    {icon}
                </div>
                <p className="text-theme-xs font-medium uppercase text-gray-400">{eyebrow}</p>
                <h1 className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                    {title}
                </h1>
            </div>
            {children}
        </section>
    );
}

function LabeledInput({
    autoComplete,
    icon,
    label,
    maxLength,
    onChange,
    type = 'text',
    value
}: {
    autoComplete?: string;
    icon?: ReactNode;
    label: string;
    maxLength?: number;
    onChange: (value: string) => void;
    type?: string;
    value: string;
}) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
                {label}
            </span>
            <span className="relative block">
                {icon && (
                    <span className="absolute left-4 top-1/2 flex -translate-y-1/2 text-gray-400">
                        {icon}
                    </span>
                )}
                <input
                    autoComplete={autoComplete}
                    className={`h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pr-4 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${
                        icon ? 'pl-11' : 'pl-4'
                    }`}
                    maxLength={maxLength}
                    onChange={(event) => onChange(event.target.value)}
                    required
                    type={type}
                    value={value}
                />
            </span>
        </label>
    );
}

function PrimaryButton({
    label,
    pending,
    pendingLabel
}: {
    label: string;
    pending: boolean;
    pendingLabel: string;
}) {
    return (
        <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:bg-brand-300"
            disabled={pending}
            type="submit"
        >
            {pending ? (
                <Loader2 className="size-4 animate-spin" />
            ) : (
                <ArrowRight className="size-4" />
            )}
            {pending ? pendingLabel : label}
        </button>
    );
}

function ResendButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            className="inline-flex w-full items-center justify-center gap-2 text-theme-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={onClick}
            type="button"
        >
            <RotateCcw className="size-4" />
            Try again
        </button>
    );
}

function ErrorText({ error }: { error: unknown }) {
    return (
        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
            {mutationError(error)}
        </p>
    );
}
