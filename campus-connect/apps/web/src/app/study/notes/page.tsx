'use client';

import { useState } from 'react';
import { ArrowLeft, NotebookPen, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { EmptyState, PageHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import type { Note } from '@/data/study';
import { appActions, useAppState } from '@/lib/store';
import { relativeTime } from '@/lib/time';
import { hueFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

export default function NotesPage() {
  const toast = useToast();
  const notes = useAppState((s) => s.notes);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('All');

  const subjects = ['All', ...Array.from(new Set(notes.map((n) => n.subject)))];
  const q = query.trim().toLowerCase();
  const visible = notes
    .filter((n) => subject === 'All' || n.subject === subject)
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const open = notes.find((n) => n.id === openId) ?? null;

  const create = () => {
    const note: Note = { id: `note-${Date.now()}`, title: '', body: '', subject: subject === 'All' ? 'General' : subject, updatedAt: new Date().toISOString(), pinned: false };
    appActions.saveNote(note);
    setOpenId(note.id);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-36 md:px-8 md:pb-16">
      <div className={cn(open && 'hidden md:block')}>
        <PageHeader
          title="Notes"
          subtitle="Quiet pages, saved on this device"
          back
          backHref="/study"
          actions={
            <Button size="sm" onClick={create}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Note
            </Button>
          }
        />
      </div>

      <div className="mt-2 grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn('space-y-3', open && 'hidden md:block')}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm shadow-card placeholder:text-text-3 focus:border-accent focus:outline-none"
            />
          </div>
          <ChipRow>
            {subjects.map((s) => (
              <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
                {s}
              </Chip>
            ))}
          </ChipRow>
          {visible.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No notes here" description="Start a page with the New button." />
          ) : (
            <div className="stagger space-y-2">
              {visible.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setOpenId(note.id)}
                  className={cn(
                    'press block w-full rounded-2xl border p-4 text-left transition-colors',
                    note.id === openId ? 'border-accent bg-accent-soft' : 'border-border bg-surface shadow-card hover:bg-surface-2',
                  )}
                >
                  <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: `hsl(${hueFor(note.subject)} 45% 48%)` }}>
                    {note.pinned && <Pin className="h-3 w-3 fill-current" aria-label="Pinned" />}
                    {note.subject}
                  </span>
                  <span className="mt-1 block truncate font-display text-[17px] font-semibold">{note.title || 'Untitled'}</span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-text-3">{note.body || 'Empty page'}</span>
                  <span className="mt-2 block text-[11px] text-text-3">{relativeTime(note.updatedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className={cn(!open && 'hidden md:block')}>
          {open ? (
            <Editor
              key={open.id}
              note={open}
              onBack={() => setOpenId(null)}
              onDelete={() => {
                appActions.deleteNote(open.id);
                setOpenId(null);
                toast('Note deleted');
              }}
            />
          ) : (
            <EmptyState icon={NotebookPen} title="Pick a note" description="Or start a fresh page. Everything saves as you type." className="min-h-[420px] justify-center" />
          )}
        </section>
      </div>
    </div>
  );
}

function Editor({ note, onBack, onDelete }: { note: Note; onBack: () => void; onDelete: () => void }) {
  const update = (patch: Partial<Note>) => appActions.saveNote({ ...note, ...patch, updatedAt: new Date().toISOString() });
  const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;

  return (
    <article className="animate-rise rounded-3xl border border-border bg-surface p-5 shadow-card md:p-8">
      <div className="flex items-center gap-2">
        <IconButton label="Back to notes" onClick={onBack} className="border border-border md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <input
          value={note.subject}
          onChange={(e) => update({ subject: e.target.value })}
          aria-label="Subject"
          className="h-8 w-40 rounded-full bg-surface-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-2 focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        <span className="ml-auto text-xs text-text-3">Saved · {words} words</span>
        <IconButton label={note.pinned ? 'Unpin' : 'Pin'} aria-pressed={note.pinned} onClick={() => update({ pinned: !note.pinned })} className={cn(note.pinned && 'text-accent')}>
          <Pin className={cn('h-[18px] w-[18px]', note.pinned && 'fill-current')} />
        </IconButton>
        <IconButton label="Delete note" onClick={onDelete} className="hover:text-danger">
          <Trash2 className="h-[18px] w-[18px]" />
        </IconButton>
      </div>
      <input
        value={note.title}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Title"
        aria-label="Title"
        className="mt-5 w-full bg-transparent font-display text-[30px] font-semibold leading-tight tracking-tight placeholder:text-text-3 focus:outline-none"
      />
      <textarea
        value={note.body}
        onChange={(e) => update({ body: e.target.value })}
        placeholder="Write freely…"
        aria-label="Note body"
        className="mt-4 min-h-[50vh] w-full resize-none bg-transparent font-read text-[17px] leading-[2rem] placeholder:text-text-3 focus:outline-none"
        style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent calc(2rem - 1px), var(--border) calc(2rem - 1px), var(--border) 2rem)', backgroundAttachment: 'local' }}
      />
    </article>
  );
}
