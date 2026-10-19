'use client';

import { useState, type FormEvent } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/fields';
import { Card, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { announcements } from '@/data/campus';
import { NOW, formatDay, relativeTime } from '@/lib/time';
import type { Announcement } from '@/lib/types';

const AUDIENCES = ['All students', 'Computer Engineering · Year 3', 'Computer Engineering · all years', 'Final years', 'First years', 'Clubs & organisers'];

export default function AdminAnnouncementsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Announcement[]>(announcements);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState(AUDIENCES[0]!);
  const [category, setCategory] = useState<Announcement['category']>('Notice');
  const [pinned, setPinned] = useState(false);
  const [expires, setExpires] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 5 || body.trim().length < 15) {
      toast('Add a clear title and at least a sentence of detail');
      return;
    }
    setItems((list) => [
      {
        id: `an-new-${Date.now()}`,
        title: title.trim(),
        body: body.trim(),
        author: 'Academic Office',
        at: NOW.toISOString(),
        audience,
        pinned,
        category,
      },
      ...list,
    ]);
    setTitle('');
    setBody('');
    setPinned(false);
    setExpires('');
    toast(`Announcement sent to ${audience}`);
  };

  return (
    <div className="grid gap-8 px-4 pb-28 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-8 md:pb-12">
      <form onSubmit={submit} className="space-y-4" aria-labelledby="compose-heading">
        <SectionHeader title="Compose" description="Students get a notification and the notice appears in the College hub." />
        <Card className="space-y-4 p-5">
          <Field label="Title" htmlFor="an-title">
            <Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Viva schedule updated" />
          </Field>
          <Field label="Message" htmlFor="an-body">
            <Textarea id="an-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Date, time, place and anything students must bring" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Audience" htmlFor="an-aud">
              <Select id="an-aud" value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </Select>
            </Field>
            <Field label="Category" htmlFor="an-cat">
              <Select id="an-cat" value={category} onChange={(e) => setCategory(e.target.value as Announcement['category'])}>
                <option>Notice</option>
                <option>College news</option>
                <option>Results</option>
                <option>Event</option>
                <option>Club</option>
                <option>Important</option>
              </Select>
            </Field>
            <Field label="Expires on" htmlFor="an-exp" hint="Optional. Removed from the notice board after this date.">
              <Input id="an-exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </Field>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <Switch label="Pin to top" description="Pinned notices stay above newer ones" checked={pinned} onChange={setPinned} />
          </div>
          <Button type="submit" full>
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            Publish announcement
          </Button>
        </Card>
      </form>

      <section aria-label="Published announcements" className="space-y-3">
        <SectionHeader title="Published" description={`${items.length} announcements`} />
        {items.map((a) => (
          <Card key={a.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {a.pinned && (
                <Badge tone="accent" icon={<Pin className="h-3 w-3" aria-hidden="true" />}>
                  Pinned
                </Badge>
              )}
              <Badge>{a.category}</Badge>
              <span className="ml-auto text-xs text-text-3">{relativeTime(a.at)} ago</span>
            </div>
            <p className="font-semibold leading-snug">{a.title}</p>
            <p className="text-sm text-text-2">{a.body}</p>
            <p className="text-xs text-text-3">
              To: {a.audience} · {formatDay(a.at)}
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
