'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Circle, ClipboardList, GraduationCap, MapPin, Plus, Timer, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Chip, ChipRow, UnderlineTabs } from '@/components/ui/chip';
import { Select } from '@/components/ui/fields';
import { Card, EmptyState, PageHeader, ProgressBar, SectionHeader, StatTile } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { assignments, academicCalendar, attendance, exams, gradeScale, results, timetable, weekDays, type Assignment, type WeekDay } from '@/data/learning';
import { getPerson } from '@/data/people';
import { daysUntil, formatDay, formatTime, NOW } from '@/lib/time';
import { cn } from '@/lib/utils';

type Tab = 'Timetable' | 'Attendance' | 'Exams' | 'Assignments' | 'Results' | 'Calendar';
const TABS: Tab[] = ['Timetable', 'Attendance', 'Exams', 'Assignments', 'Results', 'Calendar'];
// The prototype clock is fixed at Wednesday 14 Oct 2026 (see NOW in lib/time).
const TODAY_DAY: WeekDay = 'Wed';

/** How many more classes can be skipped (or must be attended) to stay at or above 75%. */
function attendanceAdvice(attended: number, total: number) {
  const pct = (attended / total) * 100;
  if (pct >= 75) {
    const canSkip = Math.max(0, Math.floor(attended / 0.75 - total));
    return { pct, text: canSkip > 0 ? `You can skip ${canSkip} more and stay above 75%.` : 'On the edge: attend every class.' };
  }
  const mustAttend = Math.ceil((0.75 * total - attended) / 0.25);
  return { pct, text: `Attend the next ${mustAttend} classes in a row to reach 75%.` };
}

export default function AcademicsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Timetable');
  const [day, setDay] = useState<WeekDay>(TODAY_DAY);
  const [items, setItems] = useState<Assignment[]>(assignments);
  const [rows, setRows] = useState(results);

  const slots = timetable.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
  const pending = items.filter((a) => a.status === 'Pending');
  const credits = rows.reduce((s, r) => s + r.credits, 0);
  const sgpa = credits ? rows.reduce((s, r) => s + r.credits * r.gradePoint, 0) / credits : 0;
  const lowAttendance = attendance.filter((a) => (a.attended / a.total) * 100 < 75).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Academic management" subtitle={`Semester 6 · ${pending.length} assignments pending`} back backHref="/campus" />

      <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
        <StatTile label="Classes" value={timetable.filter((s) => s.day === TODAY_DAY).length} hint="Today" icon={CalendarDays} href="#timetable" />
        <StatTile label="Low attendance" value={lowAttendance} hint="Below 75%" icon={UserRound} tone={lowAttendance ? 'danger' : 'success'} />
        <StatTile label="SGPA" value={sgpa.toFixed(2)} hint="Current" icon={GraduationCap} tone="info" />
      </div>

      <div className="mt-5">
        <UnderlineTabs<Tab> label="Academic sections" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t, label: t }))} />
      </div>

      {tab === 'Timetable' && (
        <section id="timetable" className="mt-5 space-y-4">
          <ChipRow>
            {weekDays.map((d) => (
              <Chip key={d} active={day === d} onClick={() => setDay(d)}>
                {d}
                {d === TODAY_DAY && <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold leading-4 text-accent-ink">Today</span>}
              </Chip>
            ))}
          </ChipRow>
          {slots.length === 0 ? (
            <EmptyState icon={CalendarDays} title="No classes this day" />
          ) : (
            <ol className="space-y-3">
              {slots.map((slot) => {
                const faculty = getPerson(slot.facultyId);
                return (
                  <li key={`${slot.day}-${slot.start}-${slot.subject}`} className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
                    <div className="w-16 shrink-0 text-center">
                      <p className="text-sm font-bold">{slot.start}</p>
                      <p className="text-xs text-text-3">{slot.end}</p>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={slot.type === 'Lab' ? 'info' : slot.type === 'Tutorial' ? 'warning' : 'accent'}>{slot.type}</Badge>
                      </div>
                      <p className="font-semibold leading-snug">{slot.subject}</p>
                      <p className="flex flex-wrap gap-x-3 text-xs text-text-3">
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{slot.room}</span>
                        <span>{faculty.name}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <Link href="/study" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
            <Timer className="h-4 w-4" aria-hidden="true" />
            Study together after class
          </Link>
        </section>
      )}

      {tab === 'Attendance' && (
        <section className="mt-5 space-y-3">
          {attendance.map((a) => {
            const advice = attendanceAdvice(a.attended, a.total);
            const low = advice.pct < 75;
            return (
              <Card key={a.subject} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{a.subject}</p>
                  <span className={cn('text-lg font-bold', low ? 'text-danger' : 'text-text')}>{advice.pct.toFixed(0)}%</span>
                </div>
                <ProgressBar value={advice.pct} tone={low ? 'danger' : advice.pct < 80 ? 'warning' : 'success'} label={`${a.subject} attendance`} />
                <p className="text-xs text-text-3">
                  {a.attended} of {a.total} attended · {advice.text}
                </p>
              </Card>
            );
          })}
        </section>
      )}

      {tab === 'Exams' && (
        <section className="mt-5 space-y-3">
          {exams.map((exam) => {
            const days = daysUntil(exam.date);
            return (
              <Card key={exam.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-center text-accent-soft-ink">
                  <span>
                    <span className="block text-lg font-bold leading-none">{days}</span>
                    <span className="text-[10px] font-semibold">days</span>
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{exam.subject} · {exam.kind}</p>
                  <p className="text-sm text-text-3">
                    {formatDay(exam.date)} · {formatTime(exam.date)} · {exam.venue}
                  </p>
                  <p className="mt-1 text-xs text-text-2">Syllabus: {exam.syllabus}</p>
                </div>
                <Link href="/study?tab=rooms" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
                  Revise together
                </Link>
              </Card>
            );
          })}
        </section>
      )}

      {tab === 'Assignments' && (
        <section className="mt-5 space-y-3">
          {items.map((a) => {
            const done = a.status === 'Submitted';
            return (
              <Card key={a.id} className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  aria-label={done ? `Mark ${a.title} as not submitted` : `Mark ${a.title} as submitted`}
                  onClick={() => {
                    setItems((list) => list.map((x) => (x.id === a.id ? { ...x, status: done ? 'Pending' : 'Submitted' } : x)));
                    toast(done ? 'Marked as not submitted' : 'Marked as submitted');
                  }}
                  className="shrink-0"
                >
                  {done ? <CheckCircle2 className="h-6 w-6 text-success" /> : <Circle className="h-6 w-6 text-text-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('font-semibold', done && 'text-text-3 line-through')}>{a.title}</p>
                  <p className="text-xs text-text-3">
                    {a.subject} · due {formatDay(a.due)}
                  </p>
                </div>
                <Badge tone={a.status === 'Submitted' ? 'success' : a.status === 'Late' ? 'danger' : 'warning'}>{a.status}</Badge>
              </Card>
            );
          })}
        </section>
      )}

      {tab === 'Results' && (
        <section className="mt-5 space-y-5">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-border bg-surface-2 px-4 py-2.5 text-xs font-semibold text-text-2">
              <span>Subject</span>
              <span className="w-14 text-center">Credits</span>
              <span className="w-16 text-center">Grade</span>
              <span className="w-10 text-right">GP</span>
            </div>
            {rows.map((row, i) => (
              <div key={row.subject} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
                <span className="truncate font-medium">{row.subject}</span>
                <span className="w-14 text-center tabular-nums">{row.credits}</span>
                <span className="w-16">
                  <Select
                    aria-label={`Grade for ${row.subject}`}
                    value={row.grade}
                    onChange={(e) => {
                      const grade = gradeScale.find((g) => g.grade === e.target.value);
                      if (!grade) return;
                      setRows((list) => list.map((r, j) => (j === i ? { ...r, grade: grade.grade, gradePoint: grade.point } : r)));
                    }}
                    className="h-8 px-2 text-sm"
                  >
                    {gradeScale.map((g) => (
                      <option key={g.grade}>{g.grade}</option>
                    ))}
                  </Select>
                </span>
                <span className="w-10 text-right tabular-nums">{row.gradePoint}</span>
              </div>
            ))}
          </Card>
          <Card className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-3">SGPA (live calculator)</p>
              <p className="text-3xl font-bold tracking-tight">{sgpa.toFixed(2)}</p>
              <p className="text-xs text-text-3">{credits} credits · change a grade to recalculate</p>
            </div>
            <ProgressBar value={sgpa} max={10} className="max-w-40" label="SGPA out of 10" />
          </Card>
          <p className="text-xs text-text-3">Official marks are on the results portal. This calculator is a planning tool.</p>
        </section>
      )}

      {tab === 'Calendar' && (
        <section className="mt-5 space-y-4">
          <SectionHeader title="Academic calendar" description={`Semester 6 · ${formatDay(NOW.toISOString())} is today`} />
          <Card className="divide-y divide-border">
            {academicCalendar
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
                    {item.kind === 'Exam' ? <ClipboardList className="h-4 w-4" /> : item.kind === 'Holiday' ? <CalendarDays className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-text-3">{formatDay(item.date)}</p>
                  </div>
                  <Badge tone={item.kind === 'Deadline' ? 'danger' : item.kind === 'Holiday' ? 'success' : 'neutral'}>{item.kind}</Badge>
                </div>
              ))}
          </Card>
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => toast('Calendar exported to your device (demo)')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add to my calendar
            </Button>
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-xs text-text-3">
        <GraduationCap className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
        Timetable and results come from the college ERP. Changes appear here within an hour.
      </p>
    </div>
  );
}
