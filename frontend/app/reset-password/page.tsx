import { ResetPasswordForm } from '@/components/ResetPasswordForm';

type Props = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(v: string | string[] | undefined) {
    return Array.isArray(v) ? v[0] : v;
}

export default async function Page({ searchParams }: Props) {
    const params = (await searchParams) ?? {};
    return <ResetPasswordForm token={firstParam(params.token) ?? null} />;
}
