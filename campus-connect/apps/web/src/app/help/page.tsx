'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, MessageSquare, Plus, Siren } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Field, Input, Select, Textarea } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { helpPosts } from '@/data/campus';
import { getPerson } from '@/data/people';
import { relativeTime } from '@/lib/time';

const KINDS = ['All', 'Notes request', 'Project help', 'Peer assistance', 'Local recommendation', 'Travel question', 'PPT/design help', 'Borrow request'] as const;

export default function HelpPage() {
  const toast = useToast();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All');
  const [askOpen, setAskOpen] = useState(false);
  const [solved, setSolved] = useState<string[]>(helpPosts.filter((p) => p.solved).map((p) => p.id));

  const visible = useMemo(
    () =>
      helpPosts
        .filter((p) => kind === 'All' || p.kind === kind)
        .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.at.localeCompare(a.at)),
    [kind],
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Student help"
        subtitle="Ask a peer. Help a peer. Earn XP for helpful answers."
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setAskOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Ask
          </Button>
        }
      />

      <div className="mt-4 space-y-4">
        <ChipRow>
          {KINDS.map((item) => (
            <Chip key={item} active={kind === item} onClick={() => setKind(item)}>
              {item}
            </Chip>
          ))}
        </ChipRow>

        {visible.length === 0 && <EmptyState icon={HelpCircle} title="No requests in this category" />}

        <div className="space-y-3">
          {visible.map((post) => {
            const author = getPerson(post.authorId);
            const isSolved = solved.includes(post.id);
            return (
              <Card key={post.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="accent">{post.kind}</Badge>
                  {post.urgent && !isSolved && <Badge tone="danger" icon={<Siren className="h-3 w-3" aria-hidden="true" />}>Urgent</Badge>}
                  {isSolved && <Badge tone="success">Solved</Badge>}
                  <span className="ml-auto text-xs text-text-3">{relativeTime(post.at)}</span>
                </div>
                <p className="font-semibold leading-snug">{post.title}</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs text-text-3">
                    <Avatar name={author.name} seed={author.id} size="xs" />
                    {author.name.split(' ')[0]} · <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {post.answers} answers
                  </span>
                  <div className="flex gap-2">
                    {!isSolved && (
                      <Button size="sm" variant="secondary" onClick={() => toast('Your answer is posted (demo). Earn 25 XP if it’s marked helpful.')}>
                        Help out
                      </Button>
                    )}
                    {!isSolved && post.authorId === 'me' && (
                      <Button size="sm" variant="ghost" onClick={() => setSolved((s) => [...s, post.id])}>
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Mark solved
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Sheet
        open={askOpen}
        onClose={() => setAskOpen(false)}
        title="Ask for help"
        description="Be specific. Peers reply faster to clear questions."
        footer={<Button full onClick={() => { setAskOpen(false); toast('Request posted to the help board (demo)'); }}>Post request</Button>}
      >
        <div className="space-y-4">
          <Field label="Type" htmlFor="hp-kind">
            <Select id="hp-kind">
              {KINDS.slice(1).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="Title" htmlFor="hp-title">
            <Input id="hp-title" placeholder="e.g. Need Unit 3 notes for OS before Friday" />
          </Field>
          <Field label="Details" htmlFor="hp-details">
            <Textarea id="hp-details" placeholder="What you tried, what you need, deadline" />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
