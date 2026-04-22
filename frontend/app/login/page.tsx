import { LoginForm } from '@/components/AuthForms';

type LoginPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const params = (await searchParams) ?? {};
    const error = firstParam(params.error);
    const challengeId = firstParam(params.challengeId);

    return (
        <LoginForm
            initialMfaChallengeId={firstParam(params.mfa) && challengeId ? challengeId : null}
            initialUrlError={
                error === 'invalid_link'
                    ? 'That link is invalid or has expired.'
                    : error === 'oauth_failed'
                      ? 'Google sign-in failed. Please try again.'
                      : null
            }
        />
    );
}
