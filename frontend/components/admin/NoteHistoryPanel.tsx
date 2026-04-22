'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/client-api';
import { useNoteVersions } from '@/hooks/useNotes';
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

const selectClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800';

export function NoteHistoryPanel({ workspace, notes }: { workspace: Workspace; notes: Note[] }) {
    const [noteId, setNoteId] = useState(notes[0]?.id ?? '');
    const activeNoteId = noteId || notes[0]?.id || '';
    const versions = useNoteVersions(workspace.id, activeNoteId || null);

    return (
        <section className="min-h-[620px] rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Note History</h2>
            <div className="mt-5">
                <select
                    className={selectClass}
                    onChange={(event) => setNoteId(event.target.value)}
                    value={activeNoteId}
                >
                    <option value="">Select note</option>
                    {notes.map((note) => (
                        <option key={note.id} value={note.id}>
                            {note.title ?? 'Untitled'} v{note.version ?? 1}
                        </option>
                    ))}
                </select>
                {versions.error && (
                    <p className="mt-3 text-sm text-red-700">{displayError(versions.error)}</p>
                )}
                <div className="mt-4 space-y-3">
                    {versions.data?.map((version) => (
                        <article
                            className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                            key={version.id}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <h3 className="font-semibold text-gray-800 dark:text-white/90">
                                    v{version.version} before {version.changeType}
                                </h3>
                                <span className="text-theme-sm text-gray-500 dark:text-gray-400">
                                    {version.changedByUserEmail}
                                </span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-theme-sm text-gray-700 dark:text-gray-300">
                                {version.content || 'No content'}
                            </p>
                        </article>
                    ))}
                    {versions.data?.length === 0 && (
                        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                            No previous versions.
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
