'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/client-api';
import type { User } from '@/lib/types';
import { queryKeys } from '@/hooks/queryKeys';

type MfaChallenge = { requiresMfa: true; challengeId: string };
type LoginSuccess = { userId: string; email: string; workspaceId?: string };

export function useMe() {
    return useQuery({
        queryKey: queryKeys.me,
        queryFn: () => apiRequest<User>('/auth/me'),
        retry: false,
        staleTime: 5 * 60 * 1000
    });
}

export function useUpdateProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { name?: string; phone?: string }) =>
            apiRequest<User>('/auth/me', {
                method: 'PATCH',
                body: input
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.me });
        }
    });
}

export function useUpdatePhone() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (phone: string) =>
            apiRequest<User>('/auth/me', {
                method: 'PATCH',
                body: { phone }
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.me });
        }
    });
}

export function useForgotPassword() {
    return useMutation({
        mutationFn: (email: string) =>
            apiRequest<{ sent: boolean }>('/auth/forgot-password', {
                method: 'POST',
                body: { email }
            })
    });
}

export function useResetPassword() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { token: string; newPassword: string }) =>
            apiRequest<MfaChallenge | LoginSuccess>('/auth/reset-password', {
                method: 'POST',
                body: input
            }),
        onSuccess: async (data) => {
            if (!('requiresMfa' in data)) await queryClient.invalidateQueries();
        }
    });
}

export function useResetPasswordMfa() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { challengeId: string; code: string }) =>
            apiRequest<LoginSuccess>('/auth/reset-password/mfa', {
                method: 'POST',
                body: input
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries();
        }
    });
}

export function useLogin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: {
            email: string;
            password: string;
            workspaceSubdomain?: string | null;
        }) =>
            apiRequest<MfaChallenge | LoginSuccess>('/auth/login', {
                method: 'POST',
                body: {
                    email: input.email,
                    password: input.password,
                    ...(input.workspaceSubdomain
                        ? { workspaceSubdomain: input.workspaceSubdomain }
                        : {})
                }
            }),
        onSuccess: async (data) => {
            if (!('requiresMfa' in data)) await queryClient.invalidateQueries();
        }
    });
}

export function useInitiateEmailOtp() {
    return useMutation({
        mutationFn: (input: { email: string; workspaceSubdomain?: string | null }) =>
            apiRequest<{ challengeId: string }>('/auth/otp/email', {
                method: 'POST',
                body: {
                    email: input.email,
                    ...(input.workspaceSubdomain
                        ? { workspaceSubdomain: input.workspaceSubdomain }
                        : {})
                }
            })
    });
}

export function useVerifyEmailOtp() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { challengeId: string; code: string }) =>
            apiRequest<MfaChallenge | LoginSuccess>('/auth/otp/email/verify', {
                method: 'POST',
                body: input
            }),
        onSuccess: async (data) => {
            if (!('requiresMfa' in data)) await queryClient.invalidateQueries();
        }
    });
}

export function useInitiateMagicLink() {
    return useMutation({
        mutationFn: (input: { email: string; workspaceSubdomain?: string | null }) =>
            apiRequest<{ sent: boolean }>('/auth/magic-link', {
                method: 'POST',
                body: {
                    email: input.email,
                    ...(input.workspaceSubdomain
                        ? { workspaceSubdomain: input.workspaceSubdomain }
                        : {})
                }
            })
    });
}

export function useInitiateSmsOtp() {
    return useMutation({
        mutationFn: (input: { phone: string; workspaceSubdomain?: string | null }) =>
            apiRequest<{ challengeId: string }>('/auth/otp/sms', {
                method: 'POST',
                body: {
                    phone: input.phone,
                    ...(input.workspaceSubdomain
                        ? { workspaceSubdomain: input.workspaceSubdomain }
                        : {})
                }
            })
    });
}

export function useVerifySmsOtp() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { challengeId: string; code: string }) =>
            apiRequest<MfaChallenge | LoginSuccess>('/auth/otp/sms/verify', {
                method: 'POST',
                body: input
            }),
        onSuccess: async (data) => {
            if (!('requiresMfa' in data)) await queryClient.invalidateQueries();
        }
    });
}

export function useVerifyMfaChallenge() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { challengeId: string; code: string }) =>
            apiRequest<LoginSuccess>('/auth/mfa/challenge', {
                method: 'POST',
                body: input
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries();
        }
    });
}

export function useSetupMfa() {
    return useMutation({
        mutationFn: () =>
            apiRequest<{ secret: string; uri: string }>('/auth/mfa/setup', {
                method: 'POST'
            })
    });
}

export function useEnableMfa() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (code: string) =>
            apiRequest<void>('/auth/mfa/enable', { method: 'POST', body: { code } }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.me });
        }
    });
}

export function useDisableMfa() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => apiRequest<void>('/auth/mfa', { method: 'DELETE' }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.me });
        }
    });
}

export function useRegister() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { email: string; password: string; name: string }) =>
            apiRequest<{ userId: string; email: string }>('/auth/register', {
                method: 'POST',
                body: input
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries();
        }
    });
}

export function useLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => apiRequest<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
        onSuccess: async () => {
            queryClient.clear();
        }
    });
}
