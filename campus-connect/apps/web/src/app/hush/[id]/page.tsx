'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Flag, Send, Trash2 } from 'lucide-react';
import { del, get, post } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { HushAnswerView, HushDetail } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch, Textarea } from '@/components/ui/fields';
import { Card, PageHeader, SectionHeader } from '@/components/ui/layout';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ReportSheet } from '@/components/common/report-sheet';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { TOPICS, VoteControl } from '@/components/hush/hush-ui';
import { ago } from '@/lib/live-time';
import { cn } from '@/lib/utils';

export default function HushQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const q = useQuery<HushDetail>(`hush:one:${id}`, (signal) => get(`/hush/${id}`, undefined, signal));
  const [answer, setAnswer] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [deleting, setDeleting] = useState<{ type: 'question' | 'answer'; id: string } | null>(null);
  const [reporting, setReporting] = useState<{ type: 'hush_question' | 'hush_answer'; id: string } | null>(null);
  const setAnswerRow = (next: HushAnswerView) => q.setData((d) => (d ? { ...d, answers: d.answers.map((a) => (a.id === next.id ? next : a)) } : d));
  const send = useAction(async () => {
    await post(`/hush/${id}/answers`, { body: answer.trim(), anonymous });
    setAnswer('');
    q.reload();
    invalidate('hush:list');
    toast('Answer posted');
  });
  const accept = useAction(async (answerId: string | null) => {
    await post(`/hush/${id}/accept`, { answerId });
    q.reload();
  });
  const remove = useAction(async () => {
    if (!deleting) return;
    await del(deleting.type === 'question' ? `/hush/${id}` : `/hush/answers/${deleting.id}`);
    setDeleting(null);
    invalidate('hush:');
    if (deleting.type === 'question') router.replace('/hush');
    else q.reload();
  });
  const h = q.data;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Hush" back backHref="/hush" />
      {q.loading && <SkeletonList count={2} />}
      {q.error && <ErrorState error={q.error} onRetry={q.reload} />}
      {h && (
        <Reveal className="space-y-6">
          <Card className="flex gap-3 p-4">
            <VoteControl path={`/hush/${h.id}/vote`} value={h.myVote} count={h.votesCount} onChange={(v, c) => q.setData((d) => (d ? { ...d, myVote: v, votesCount: c } : d))} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{TOPICS[h.topic] ?? h.topic}</Badge>
                <span className="text-[12px] text-text-3">{h.anonymous ? 'Anonymous' : h.author?.displayName} · {ago(h.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[16px] leading-relaxed">{h.body}</p>
              <div className="mt-3 flex gap-2">
                {h.isMine ? (
                  <Button size="sm" variant="ghost" onClick={() => setDeleting({ type: 'question', id: h.id })}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setReporting({ type: 'hush_question', id: h.id })}><Flag className="h-4 w-4" aria-hidden="true" /> Report</Button>
                )}
              </div>
            </div>
          </Card>

          <section aria-label="Answers">
            <SectionHeader title={`${h.answers.length} answer${h.answers.length === 1 ? '' : 's'}`} description={h.isMine ? 'Mark the answer that helped you, so others find it first.' : undefined} />
            {!h.answers.length && <p className="text-[14px] text-text-3">No answers yet. Yours could be the first.</p>}
            <Stagger className="space-y-3">
              {h.answers.map((a) => (
                <StaggerItem key={a.id}>
                  <div className={cn('flex gap-3 rounded-2xl border bg-surface p-4', a.accepted ? 'border-success/50' : 'border-border')}>
                    <VoteControl path={`/hush/answers/${a.id}/vote`} value={a.myVote} count={a.votesCount} onChange={(v, c) => setAnswerRow({ ...a, myVote: v, votesCount: c })} />
                    <div className="min-w-0 flex-1">
                      {a.accepted && <p className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-success"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Helped the asker</p>}
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{a.body}</p>
                      <p className="mt-2 text-[12px] text-text-3">{a.anonymous ? 'Anonymous' : a.author?.displayName} · {ago(a.createdAt)}{a.isMine ? ' · yours' : ''}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {h.isMine && <Button size="sm" variant={a.accepted ? 'soft' : 'secondary'} onClick={() => void accept.run(a.accepted ? null : a.id)} disabled={accept.pending}><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{a.accepted ? 'Unmark' : 'This helped'}</Button>}
                        {a.isMine ? <Button size="sm" variant="ghost" onClick={() => setDeleting({ type: 'answer', id: a.id })}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</Button> : <Button size="sm" variant="ghost" onClick={() => setReporting({ type: 'hush_answer', id: a.id })}><Flag className="h-4 w-4" aria-hidden="true" /> Report</Button>}
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </section>

          <section aria-label="Your answer">
            <SectionHeader title="Your answer" />
            <Card className="space-y-3 p-4">
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={5000} rows={4} placeholder="Share what worked for you. Be kind and specific." aria-label="Your answer" />
              <div className="overflow-hidden rounded-2xl border border-border"><Switch checked={anonymous} onChange={setAnonymous} label="Answer anonymously" /></div>
              {send.error && <FormAlert>{send.error.message}</FormAlert>}
              <Button full onClick={() => void send.run()} disabled={answer.trim().length < 10 || send.pending}>{send.pending ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />} Post answer</Button>
            </Card>
          </section>
        </Reveal>
      )}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => void remove.run()} title={deleting?.type === 'question' ? 'Delete your question?' : 'Delete your answer?'} description="This cannot be undone." confirmLabel="Delete" danger pending={remove.pending} error={remove.error?.message} />
      {reporting && <ReportSheet open onClose={() => setReporting(null)} targetType={reporting.type} targetId={reporting.id} label={reporting.type === "hush_question" ? "this question" : "this answer"} />}
    </div>
  );
}
