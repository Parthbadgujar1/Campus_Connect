'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bookmark, Copy, Download, Ellipsis, FileText, Flag, Ghost, Heart, MessageCircle, Pencil, Pin, Send, Trash2 } from 'lucide-react';
import { ReportSheet } from '@/components/common/report-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/fields';
import { Menu } from '@/components/ui/menu';
import { PersonAvatar, PersonName } from '@/components/ui/person-avatar';
import { ConfirmDialog, FormAlert } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { del, errorMessage, patch, put } from '@/lib/api/client';
import type { FileView, PostView } from '@/lib/api/types';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

function audienceLabel(a: PostView['audience']): string {
  switch (a.type) {
    case 'department':
      return a.department ?? 'Department';
    case 'year':
      return `Year ${a.year}`;
    case 'division':
      return `Year ${a.year} · Div ${a.division}`;
    case 'space':
      return a.space?.name ?? 'Space';
    default:
      return 'Whole campus';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Attachments({ files, poster }: { files: FileView[]; poster?: string | null }) {
  if (!files.length) return null;
  const images = files.filter((f) => f.kind === 'image' && f.url);
  const others = files.filter((f) => !(f.kind === 'image' && f.url));
  return (
    <div className="mt-4 space-y-2">
      {images.length > 0 && (
        <div className={cn('grid gap-1.5 overflow-hidden rounded-2xl', images.length > 1 && 'grid-cols-2')}>
          {images.slice(0, 4).map((f) => (
            <a key={f.id} href={f.url!} target="_blank" rel="noopener noreferrer" className="block bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.thumbnailUrl ?? f.url!} alt={f.name} loading="lazy" className={cn('w-full object-cover', images.length > 1 ? 'aspect-square' : 'max-h-[480px]')} />
            </a>
          ))}
        </div>
      )}
      {others.map((f) =>
        f.kind === 'video' && f.url ? (
          <video key={f.id} src={f.url} poster={poster ?? undefined} controls preload="metadata" playsInline className="max-h-[560px] w-full rounded-2xl bg-black" aria-label={f.name} />
        ) : f.kind === 'audio' && f.url ? (
          <audio key={f.id} src={f.url} controls preload="metadata" className="w-full" aria-label={f.name} />
        ) : (
          <a key={f.id} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 hover:bg-surface-3">
            <FileText className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{f.name}</span>
              <span className="block text-[12px] text-text-3">{f.status === 'ready' ? formatSize(f.size) : 'Checking the file…'}</span>
            </span>
            <Download className="h-4 w-4 text-text-3" aria-hidden="true" />
          </a>
        ),
      )}
    </div>
  );
}

export function LivePostCard({ post, onChange, onRemove, detailed = false }: { post: PostView; onChange: (p: PostView) => void; onRemove: (id: string) => void; detailed?: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = `/post/${post.id}`;

  const toggleLike = async () => {
    const next = !post.liked;
    onChange({ ...post, liked: next, likesCount: post.likesCount + (next ? 1 : -1) });
    try {
      const r = await (next ? put<{ likesCount: number }>(`/posts/${post.id}/like`) : del<{ likesCount: number }>(`/posts/${post.id}/like`));
      onChange({ ...post, liked: next, likesCount: r.likesCount });
    } catch (err) {
      onChange(post);
      toast(errorMessage(err));
    }
  };

  const toggleSave = async () => {
    const next = !post.saved;
    onChange({ ...post, saved: next });
    try {
      await (next ? put(`/saved/post/${post.id}`) : del(`/saved/post/${post.id}`));
      toast(next ? 'Saved to your list' : 'Removed from saved');
    } catch (err) {
      onChange(post);
      toast(errorMessage(err));
    }
  };

  const vote = async (optionId: string) => {
    try {
      const poll = await put<PostView['poll']>(`/posts/${post.id}/vote`, { optionId });
      onChange({ ...post, poll });
    } catch (err) {
      toast(errorMessage(err));
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'CampusConnect post', url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      // The person closed the share sheet.
    }
  };

  const saveEdit = async () => {
    setError(null);
    try {
      const updated = await patch<PostView>(`/posts/${post.id}`, { body: draft.trim() });
      onChange(updated);
      setEditing(false);
      toast('Post updated');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await del(`/posts/${post.id}`);
      onRemove(post.id);
      toast('Post deleted');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const voted = Boolean(post.poll?.myVote);

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-card" aria-label={`Post by ${post.anonymous ? 'someone on campus' : (post.author?.displayName ?? 'Deleted user')}`}>
      <header className="flex items-center gap-3">
        {post.anonymous ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-3 text-text-2">
            <Ghost className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : (
          <PersonAvatar person={post.author} link />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px]">
            {post.anonymous ? <span className="font-semibold">{post.isMine ? 'You (anonymous)' : 'Someone on campus'}</span> : <PersonName person={post.author} />}
          </div>
          <p className="truncate text-[12.5px] text-text-3">
            <time dateTime={post.createdAt}>{ago(post.createdAt)}</time> · {audienceLabel(post.audience)}
            {post.kind === 'question' && ' · Question'}
          </p>
        </div>
        <Menu
          label="Post options"
          trigger={<Ellipsis className="h-5 w-5" aria-hidden="true" />}
          items={[
            { label: 'Copy link', icon: Copy, onSelect: () => void navigator.clipboard.writeText(`${window.location.origin}${link}`).then(() => toast('Link copied')) },
            { label: post.saved ? 'Remove from saved' : 'Save', icon: Bookmark, onSelect: toggleSave },
            { label: 'Edit', icon: Pencil, onSelect: () => { setDraft(post.body); setEditing(true); }, hidden: !post.isMine },
            { label: 'Delete', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true), hidden: !post.isMine },
            { label: 'Report', icon: Flag, danger: true, onSelect: () => setReporting(true), hidden: post.isMine },
          ]}
        />
      </header>

      <div className="mt-4">
        {post.pinned && (
          <Badge tone="accent" className="mb-2.5">
            <Pin className="mr-1 inline h-3 w-3" aria-hidden="true" /> Pinned
          </Badge>
        )}
        {editing ? (
          <div className="space-y-2">
            {error && <FormAlert>{error}</FormAlert>}
            <label htmlFor={`edit-${post.id}`} className="sr-only">Edit post</label>
            <Textarea id={`edit-${post.id}`} value={draft} maxLength={5000} onChange={(e) => setDraft(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={!draft.trim() || draft === post.body}>Save</Button>
            </div>
          </div>
        ) : detailed ? (
          <p className="whitespace-pre-line text-[15.5px] leading-relaxed text-pretty">{post.body}</p>
        ) : (
          <Link href={link} className="block whitespace-pre-line text-[15.5px] leading-relaxed text-pretty">
            <span className="line-clamp-6">{post.body}</span>
          </Link>
        )}
        {post.tags.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`} className="font-sans rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-2 hover:text-text">
                #{tag}
              </Link>
            ))}
          </p>
        )}
      </div>

      <Attachments files={post.attachments} poster={post.cover?.url} />

      {post.poll && (
        <div className="font-sans mt-4 space-y-2 rounded-2xl bg-surface-2 p-3.5" role="group" aria-label="Poll">
          {post.poll.options.map((option) => {
            const pct = post.poll!.totalVotes ? Math.round((option.votes / post.poll!.totalVotes) * 100) : 0;
            const chosen = post.poll!.myVote === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => vote(option.id)}
                aria-pressed={chosen}
                className={cn('press relative flex w-full items-center justify-between overflow-hidden rounded-2xl border px-4 py-3 text-left text-sm', chosen ? 'border-accent bg-surface' : 'border-border bg-surface')}
              >
                {voted && <span className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-500" style={{ width: `${pct}%` }} aria-hidden="true" />}
                <span className="relative font-semibold">{option.label}</span>
                {voted && <span className="relative text-xs font-bold text-text-2">{pct}%</span>}
              </button>
            );
          })}
          <p className="px-1 text-xs text-text-3">
            {post.poll.totalVotes.toLocaleString('en-IN')} votes · {voted ? 'tap another option to change your vote' : 'tap to vote'}
          </p>
        </div>
      )}

      <footer className="font-sans mt-4 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={post.liked}
          aria-label={post.liked ? `Liked, ${post.likesCount}` : `Like, ${post.likesCount}`}
          className={cn('press flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors', post.liked ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text-2 hover:text-text')}
        >
          <Heart className={cn('h-[18px] w-[18px]', post.liked && 'fill-current')} aria-hidden="true" />
          <span className="tabular-nums">{post.likesCount.toLocaleString('en-IN')}</span>
        </button>
        <Link href={link} aria-label={`Replies, ${post.commentsCount}`} className="press flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-text-2 hover:bg-surface-2 hover:text-text">
          <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          {post.commentsCount}
        </Link>
        <button type="button" onClick={share} aria-label="Share" className="press flex h-10 items-center rounded-full px-3 text-text-2 hover:bg-surface-2 hover:text-text">
          <Send className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={post.saved}
          aria-label={post.saved ? 'Saved. Tap to remove' : 'Save this post'}
          className={cn('press ml-auto flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-surface-2', post.saved ? 'text-accent' : 'text-text-2')}
        >
          <Bookmark className={cn('h-[18px] w-[18px]', post.saved && 'fill-current')} aria-hidden="true" />
          <span className="hidden sm:inline">{post.saved ? 'Saved' : 'Save'}</span>
        </button>
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        title="Delete this post?"
        description="It disappears for everyone, with its likes and replies. This cannot be undone."
        confirmLabel="Delete post"
        danger
        pending={deleting}
      />
      <ReportSheet open={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post.id} label="this post" />
    </article>
  );
}
