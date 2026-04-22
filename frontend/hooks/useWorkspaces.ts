'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/client-api';
import type { Workspace, WorkspaceListItem, ResolvedWorkspace } from '@/lib/types';
import { queryKeys } from '@/hooks/queryKeys';

export function useWorkspaces(enabled = true) {
    return useQuery({
        queryKey: queryKeys.workspaces,
        queryFn: () => apiRequest<WorkspaceListItem[]>('/workspaces'),
        enabled
    });
}

export function useResolveWorkspace(subdomain: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.workspaceBySubdomain(subdomain),
        queryFn: () => apiRequest<ResolvedWorkspace>(`/workspaces/resolve/${subdomain}`),
        enabled: enabled && Boolean(subdomain),
        retry: false
    });
}

export function useCreateWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: { name: string; subdomain?: string; displayName?: string }) =>
            apiRequest<Workspace>('/workspaces', {
                method: 'POST',
                body: input
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        }
    });
}

export function useLeaveWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (workspaceId: string) =>
            apiRequest<{ left: boolean; workspaceId: string }>(
                `/workspaces/${workspaceId}/members/me`,
                {
                    method: 'DELETE'
                }
            ),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        }
    });
}

export function useDeleteWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (workspaceId: string) =>
            apiRequest<{ deleted: boolean }>(`/workspaces/${workspaceId}`, { method: 'DELETE' }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        }
    });
}
