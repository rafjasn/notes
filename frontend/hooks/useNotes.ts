'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';
import { decryptNotes, encryptNoteInput } from '@/lib/encryption';
import { subscribeToChannel } from '@/lib/realtime';
import type { Note, NoteVersion } from '@/lib/types';
import { queryKeys } from '@/hooks/queryKeys';

export function useNotes(workspaceId: string | null) {
    return useQuery({
        queryKey: queryKeys.notes(workspaceId),
        queryFn: async () =>
            decryptNotes(
                await apiRequest<Note[]>(`/workspaces/${workspaceId}/notes`),
                workspaceId ?? undefined
            ),
        enabled: Boolean(workspaceId)
    });
}

export function useDeletedNotes(workspaceId: string | null) {
    return useQuery({
        queryKey: queryKeys.deletedNotes(workspaceId),
        queryFn: async () =>
            decryptNotes(
                await apiRequest<Note[]>(`/workspaces/${workspaceId}/notes/deleted`),
                workspaceId ?? undefined
            ),
        enabled: Boolean(workspaceId),
        retry: false
    });
}

export function useNoteVersions(workspaceId: string | null, noteId: string | null) {
    return useQuery({
        queryKey: queryKeys.noteVersions(workspaceId, noteId),
        queryFn: async () =>
            decryptNotes(
                await apiRequest<NoteVersion[]>(
                    `/workspaces/${workspaceId}/notes/${noteId}/versions`
                ),
                workspaceId ?? undefined
            ),
        enabled: Boolean(workspaceId && noteId),
        retry: false
    });
}

export function useRealtimeNotes(workspaceId: string | null) {
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!workspaceId) {
            return undefined;
        }

        return subscribeToChannel(`private-workspace:${workspaceId}:notes`, () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.notes(workspaceId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.deletedNotes(workspaceId) });
        });
    }, [workspaceId, queryClient]);
}

export function useCreateNote(workspaceId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { title: string; content: string }) =>
            decryptNotes(
                [
                    await apiRequest<Note>(`/workspaces/${workspaceId}/notes`, {
                        method: 'POST',
                        body: await encryptNoteInput(input, workspaceId)
                    })
                ],
                workspaceId
            ).then(([note]) => note),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.notes(workspaceId) });
        }
    });
}

export function useUpdateNote(workspaceId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { noteId: string; title: string; content: string }) =>
            decryptNotes(
                [
                    await apiRequest<Note>(`/workspaces/${workspaceId}/notes/${input.noteId}`, {
                        method: 'PATCH',
                        body: await encryptNoteInput(
                            { title: input.title, content: input.content },
                            workspaceId
                        )
                    })
                ],
                workspaceId
            ).then(([note]) => note),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.notes(workspaceId) });
        }
    });
}

export function useDeleteNote(workspaceId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (noteId: string) =>
            apiRequest<{ deleted: boolean }>(`/workspaces/${workspaceId}/notes/${noteId}`, {
                method: 'DELETE'
            }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.notes(workspaceId) });
        }
    });
}
