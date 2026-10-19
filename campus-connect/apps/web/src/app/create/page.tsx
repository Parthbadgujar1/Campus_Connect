'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Camera, Ghost, Image as ImageIcon, Plus, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Segmented } from '@/components/ui/chip';
import { PageHeader } from '@/components/ui/layout';
import { InfoBanner } from '@/components/common/cards';
import { useToast } from '@/components/ui/toast';
import { communities } from '@/data/communities';
import { college, me } from '@/data/people';
import { useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

type Kind = 'post' | 'question' | 'poll' | 'anonymous';
type Scope = 'college' | 'department' | 'year' | 'division' | 'community';

const MAX = 1000;

export default function CreatePostPage() {
  const router = useRouter();
  const toast = useToast();
  const joined = useAppState((s) => s.joined);
  const [kind, setKind] = useState<Kind>('post');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<Scope>('college');
  const [communityId, setCommunityId] = useState(communities.find((c) => joined.includes(c.id))?.id ?? '');
  const [tags, setTags] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [error, setError] = useState<string | null>(null);

  const anonymous = kind === 'anonymous';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (body.trim().length < 3) {
      setError('Write a little more before posting.');
      return;
    }
    if (kind === 'poll' && options.filter((o) => o.trim()).length < 2) {
      setError('A poll needs at least two options.');
      return;
    }
    setError(null);
    toast(anonymous ? 'Posted anonymously' : 'Posted to your feed');
    router.push('/');
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="New post"
        back
        backHref="/"
        actions={
          <Button size="sm" type="submit" form="create-form" disabled={body.trim().length === 0}>
            Post
          </Button>
        }
      />

      <form id="create-form" onSubmit={submit} className="mt-4 space-y-5" noValidate>
        <Segmented<Kind>
          label="Post type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'post', label: 'Post' },
            { value: 'question', label: 'Question' },
            { value: 'poll', label: 'Poll' },
            { value: 'anonymous', label: 'Anonymous' },
          ]}
        />

        {anonymous && (
          <InfoBanner icon={Ghost} title="Your name is hidden">
            Other students see “Anonymous · verified student”. Moderators can only see your identity through the admin review process when a report requires it.
          </InfoBanner>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full', anonymous ? 'bg-surface-3 text-text-2' : 'bg-accent text-accent-ink')}>
            {anonymous ? <Ghost className="h-5 w-5" aria-hidden="true" /> : me.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <Field label={kind === 'question' ? 'Your question' : 'What’s on your mind?'} htmlFor="post-body" className="gap-0">
              <Textarea
                id="post-body"
                value={body}
                maxLength={MAX}
                onChange={(e) => setBody(e.target.value)}
                placeholder={kind === 'question' ? 'Ask your college or department…' : 'Share a notice, a win, a question or a thought'}
                className="min-h-32 border-0 bg-transparent px-0 py-1 focus:ring-0"
                aria-invalid={!!error}
              />
            </Field>
            <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
              <button type="button" onClick={() => toast('Photo picker opens on device (demo)')} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface-2" aria-label="Add photo">
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => toast('Video picker opens on device (demo)')} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface-2" aria-label="Add video">
                <Video className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => toast('Camera opens on device (demo)')} className="grid h-9 w-9 place-items-center rounded-full text-text-2 hover:bg-surface-2" aria-label="Use camera">
                <Camera className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="ml-auto text-xs text-text-3">
                {body.length}/{MAX}
              </span>
            </div>
          </div>
        </div>

        {kind === 'poll' && (
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold">Poll options</p>
            {options.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Option ${i + 1}`}
                  placeholder={`Option ${i + 1}`}
                  value={option}
                  onChange={(e) => setOptions((opts) => opts.map((o, j) => (j === i ? e.target.value : o)))}
                />
                {options.length > 2 && (
                  <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setOptions((opts) => opts.filter((_, j) => j !== i))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-text-3 hover:bg-surface-2">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 5 && (
              <Button variant="ghost" size="sm" type="button" onClick={() => setOptions((opts) => [...opts, ''])}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add option
              </Button>
            )}
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          <Field label="Who can see this" htmlFor="post-scope">
            <Select id="post-scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="college">Whole college</option>
              <option value="department">My department ({me.branch})</option>
              <option value="year">My year (Year {me.year})</option>
              <option value="division">My division ({me.division})</option>
              <option value="community">A community I joined</option>
            </Select>
          </Field>
          {scope === 'community' && (
            <Field label="Community" htmlFor="post-community">
              <Select id="post-community" value={communityId} onChange={(e) => setCommunityId(e.target.value)}>
                {communities.filter((c) => joined.includes(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Tags" htmlFor="post-tags" hint="Comma separated, e.g. hackathon, notes">
            <Input id="post-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="hackathon, notes" />
          </Field>
        </section>

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <p className="text-xs text-text-3">
          Posts follow the {college.shortName} community guidelines. Harassment, spam and scams are removed, and repeat reports lead to review.
        </p>
      </form>
    </div>
  );
}
