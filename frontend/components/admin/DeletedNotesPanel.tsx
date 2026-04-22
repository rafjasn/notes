'use client';

import { ApiError } from '@/lib/client-api';
import { useDeletedNotes } from '@/hooks/useNotes';
import type { Workspace, Note } from '@/lib/types';

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

function NotePreview({ note }: { note: Note }) {
    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white/90">
                        {note.title ?? 'Untitled'}
                    </h3>
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                        {note.userEmail}
                    </p>
                </div>
                <span className="rounded-full bg-error-50 px-2.5 py-0.5 text-theme-xs font-medium text-error-600 dark:bg-error-500/15 dark:text-error-500">
                    Deleted
                </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-theme-sm text-gray-700 dark:text-gray-300">
                {note.content || 'No content'}
            </p>
            {note.encryptionError && (
                <p className="mt-3 text-sm text-amber-700">{note.encryptionError}</p>
            )}
        </article>
    );
}

export function DeletedNotesPanel({ workspace }: { workspace: Workspace }) {
    const deletedNotes = useDeletedNotes(workspace.id);

    return (
        <section className="min-h-[620px] rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                Deleted Notes
            </h2>
            <div className="mt-5">
                {deletedNotes.error && (
                    <p className="mt-3 text-sm text-red-700">{displayError(deletedNotes.error)}</p>
                )}
                {deletedNotes.isPending && (
                    <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                        Loading deleted notes.
                    </p>
                )}
                <div className="space-y-3">
                    {deletedNotes.data?.map((note) => (
                        <NotePreview key={note.id} note={note} />
                    ))}
                    {deletedNotes.data?.length === 0 && (
                        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                            No deleted notes.
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
