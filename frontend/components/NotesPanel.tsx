'use client';

import { FormEvent, useState } from 'react';
import { FileText, Loader2, Pencil, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import { ApiError } from '@/lib/client-api';
import { encryptionConfigured } from '@/lib/encryption';
import {
    useCreateNote,
    useDeleteNote,
    useNotes,
    useRealtimeNotes,
    useUpdateNote
} from '@/hooks/useNotes';
import type { Workspace } from '@/lib/types';

const inputClass =
    'h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

const textareaClass =
    'w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-theme-sm text-gray-800 shadow-theme-xs outline-hidden placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800';

function displayError(error: unknown) {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return 'Something went wrong';
}

function ErrorText({ error }: { error: unknown }) {
    return (
        <p className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-theme-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
            {displayError(error)}
        </p>
    );
}

export function NotesPanel({ workspace }: { workspace: Workspace }) {
    const notes = useNotes(workspace.id);
    const createNote = useCreateNote(workspace.id);
    const updateNote = useUpdateNote(workspace.id);
    const deleteNote = useDeleteNote(workspace.id);
    useRealtimeNotes(workspace.id);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const selectedNote =
        notes.data?.find((note) => note.id === selectedNoteId) ?? notes.data?.[0] ?? null;
    const editingSelectedNote = Boolean(selectedNote && editingNoteId === selectedNote.id);

    async function onCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const note = await createNote.mutateAsync({ title: newTitle, content: newContent });
        setNewTitle('');
        setNewContent('');
        setSelectedNoteId(note.id);
        setEditingNoteId(null);
    }

    async function onSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedNote) return;
        const formData = new FormData(event.currentTarget);
        await updateNote.mutateAsync({
            noteId: selectedNote.id,
            title: String(formData.get('title') ?? ''),
            content: String(formData.get('content') ?? '')
        });
        setEditingNoteId(null);
    }

    async function onDelete() {
        if (!selectedNote) return;
        await deleteNote.mutateAsync(selectedNote.id);
        setSelectedNoteId(null);
        setEditingNoteId(null);
    }

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <p className="text-theme-xs font-medium uppercase text-gray-400">
                        Realtime notes
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-gray-800 dark:text-white/90">
                        {workspace.name}
                    </h2>
                    <p className="font-mono text-theme-sm text-gray-500 dark:text-gray-400">
                        {workspace.subdomain}
                    </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-0.5 text-theme-xs font-medium text-success-600 dark:bg-success-500/15 dark:text-success-500">
                    <ShieldCheck className="size-3.5" />
                    {encryptionConfigured() ? 'Encrypted' : 'Plaintext'}
                </span>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <form className="flex flex-col gap-3" onSubmit={onCreate}>
                    <input
                        className={`${inputClass} bg-white dark:bg-gray-900`}
                        onChange={(event) => setNewTitle(event.target.value)}
                        placeholder="Note title"
                        required
                        value={newTitle}
                    />
                    <textarea
                        className={`${textareaClass} min-h-36 resize-y bg-white dark:bg-gray-900`}
                        onChange={(event) => setNewContent(event.target.value)}
                        placeholder="Note content"
                        value={newContent}
                    />
                    {createNote.error && <ErrorText error={createNote.error} />}
                    <button
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-theme-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:bg-brand-300"
                        disabled={createNote.isPending}
                        type="submit"
                    >
                        {createNote.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Plus className="size-4" />
                        )}
                        {createNote.isPending ? 'Adding' : 'Add note'}
                    </button>
                </form>
            </div>

            <div className="mt-6 space-y-2">
                {notes.isPending && (
                    <p className="inline-flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
                        <Loader2 className="size-4 animate-spin" />
                        Loading notes
                    </p>
                )}
                {notes.error && <ErrorText error={notes.error} />}
                {notes.data?.map((note) => {
                    const active = selectedNote?.id === note.id;
                    const title = note.title ?? note.encryptedTitle ?? 'Untitled';
                    return (
                        <div
                            className={`rounded-2xl border p-4 ${
                                active
                                    ? 'border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10'
                                    : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950'
                            }`}
                            key={note.id}
                        >
                            {!active ? (
                                <button
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-white/5"
                                    onClick={() => {
                                        setSelectedNoteId(note.id);
                                        setEditingNoteId(null);
                                    }}
                                    type="button"
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <FileText className="size-4 text-gray-400" />
                                        <span className="truncate text-theme-sm font-medium text-gray-800 dark:text-white/90">
                                            {title}
                                        </span>
                                    </span>
                                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-theme-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
                                        v{note.version ?? 1}
                                    </span>
                                </button>
                            ) : editingSelectedNote && selectedNote ? (
                                <form
                                    className="flex flex-col gap-4"
                                    key={selectedNote.id}
                                    onSubmit={onSave}
                                >
                                    <input
                                        className={`${inputClass} bg-white text-lg font-semibold dark:bg-gray-900`}
                                        defaultValue={
                                            selectedNote.title ?? selectedNote.encryptedTitle ?? ''
                                        }
                                        name="title"
                                        required
                                    />
                                    <textarea
                                        className={`${textareaClass} min-h-52 resize-y bg-white dark:bg-gray-900`}
                                        defaultValue={selectedNote.content ?? ''}
                                        name="content"
                                    />
                                    {(updateNote.error || deleteNote.error) && (
                                        <ErrorText error={updateNote.error ?? deleteNote.error} />
                                    )}
                                    {selectedNote.encryptionError && (
                                        <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-theme-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-400">
                                            {selectedNote.encryptionError}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap justify-between gap-3">
                                        <button
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-500 shadow-theme-xs hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                                            onClick={() => setEditingNoteId(null)}
                                            type="button"
                                        >
                                            <X className="size-4" />
                                            Cancel
                                        </button>
                                        <div className="flex gap-3">
                                            <button
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-error-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-error-600 shadow-theme-xs hover:bg-error-50 disabled:opacity-60 dark:border-error-500/30 dark:bg-gray-900 dark:text-error-400 dark:hover:bg-error-500/10"
                                                disabled={deleteNote.isPending}
                                                onClick={onDelete}
                                                type="button"
                                            >
                                                {deleteNote.isPending ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="size-4" />
                                                )}
                                                {deleteNote.isPending ? 'Deleting' : 'Delete'}
                                            </button>
                                            <button
                                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-theme-sm font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300"
                                                disabled={updateNote.isPending}
                                                type="submit"
                                            >
                                                {updateNote.isPending ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Save className="size-4" />
                                                )}
                                                {updateNote.isPending ? 'Saving' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            ) : (
                                <article className="space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <FileText className="size-4 shrink-0 text-brand-500" />
                                            <h3 className="truncate text-lg font-semibold text-gray-800 dark:text-white/90">
                                                {title}
                                            </h3>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-theme-xs text-gray-500 dark:bg-white/10 dark:text-gray-400">
                                            v{note.version ?? 1}
                                        </span>
                                    </div>
                                    {note.encryptionError && (
                                        <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-theme-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-400">
                                            {note.encryptionError}
                                        </p>
                                    )}
                                    <div className="min-h-28 whitespace-pre-wrap rounded-xl border border-gray-200 bg-white px-4 py-3 text-theme-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                                        {note.content || (
                                            <span className="text-gray-400 dark:text-gray-500">
                                                No content yet.
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                                            onClick={() => setEditingNoteId(note.id)}
                                            type="button"
                                        >
                                            <Pencil className="size-4" />
                                            Edit note
                                        </button>
                                    </div>
                                </article>
                            )}
                        </div>
                    );
                })}
                {notes.data?.length === 0 && (
                    <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-theme-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        No notes yet.
                    </p>
                )}
            </div>
        </section>
    );
}
