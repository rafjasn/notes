'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/client-api';
import type { InvitationResult, Member, Role } from '@/lib/types';
import { queryKeys } from '@/hooks/queryKeys';

type InvitationPreview = { workspaceName: string; email: string; expiresAt: string };
type AcceptResult = {
    membershipId: string;
    workspaceId: string;
    displayName: string;
    roleIds: string[];
};

export function useInvitationPreview(token: string | null) {
    return useQuery({
        queryKey: ['invitation-preview', token],
        queryFn: () => apiRequest<InvitationPreview>(`/invitations/${token}/preview`),
        enabled: Boolean(token),
        retry: false
    });
}

export function useAcceptInvitation(token: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: { displayName?: string }) =>
            apiRequest<AcceptResult>(`/invitations/${token}/accept`, { method: 'POST', body }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        }
    });
}

export function useRoles(workspaceId: string | null) {
    return useQuery({
        queryKey: queryKeys.roles(workspaceId),
        queryFn: () => apiRequest<Role[]>(`/workspaces/${workspaceId}/roles`),
        enabled: Boolean(workspaceId),
        retry: false
    });
}

export function useMembers(workspaceId: string | null) {
    return useQuery({
        queryKey: queryKeys.members(workspaceId),
        queryFn: () => apiRequest<Member[]>(`/workspaces/${workspaceId}/members`),
        enabled: Boolean(workspaceId),
        retry: false
    });
}

export function useCreateRole(workspaceId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { description?: string; name: string; permissions: string[] }) =>
            apiRequest<Role>(`/workspaces/${workspaceId}/roles`, {
                method: 'POST',
                body: input
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.roles(workspaceId) });
        }
    });
}

export function useUpdateMemberRoles(workspaceId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { roleIds: string[]; userId: string }) =>
            apiRequest<Member>(`/workspaces/${workspaceId}/members/${input.userId}/roles`, {
                method: 'PATCH',
                body: { roleIds: input.roleIds }
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) });
        }
    });
}

export function useInviteUser(workspaceId: string) {
    return useMutation({
        mutationFn: (input: { email: string; roleIds: string[] }) =>
            apiRequest<InvitationResult>(`/workspaces/${workspaceId}/invitations`, {
                method: 'POST',
                body: input
            })
    });
}
