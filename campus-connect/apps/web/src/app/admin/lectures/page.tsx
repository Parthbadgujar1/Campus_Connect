'use client';

import { useState, type FormEvent } from 'react';
import { Eye, Film, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/fields';
import { Card, SectionHeader } from '@/components/ui/layout';
import { useToast } from '@/components/ui/toast';
import { lectures } from '@/data/learning';
import { faculty, getPerson, college } from '@/data/people';
import { NOW, relativeTime } from '@/lib/time';

export default function AdminLecturesPage() {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [facultyId, setFacultyId] = useState(faculty[0]?.id ?? '');
  const [semester, setSemester] = useState('6');
  const [description, setDescription] = useState('');
  const [publish, setPublish] = useState(true);
  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState(lectures);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !subject.trim() || !fileName) {
      toast('Add a title, subject and video file first');
      return;
    }
    setItems((list) => [
      {
        id: `lec-new-${Date.now()}`,
        title: title.trim(),
        subject: subject.trim(),
        facultyId,
        semester: Number(semester),
        durationMin: 0,
        views: 0,
        uploadedAt: NOW.toISOString(),
        seed: `lec-new-${title.length}`,
        description: description.trim(),
        chapters: [],
        notes: [],
        published: publish,
      },
      ...list,
    ]);
    toast(publish ? 'Uploaded. It is processing and will appear for Semester ' + semester + ' students shortly.' : 'Saved as draft');
    setTitle('');
    setSubject('');
    setDescription('');
    setFileName('');
  };

  return (
    <div className="grid gap-8 px-4 pb-28 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:px-8 md:pb-12">
      <form onSubmit={submit} className="space-y-4" aria-labelledby="upload-heading">
        <SectionHeader title="Upload a faculty lecture" description="Videos are checked for copyright and processed into chapters and captions." />
        <Card className="space-y-4 p-5">
          <Field label="Lecture title" htmlFor="lu-title">
            <Input id="lu-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Normalisation: 1NF to BCNF" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Subject" htmlFor="lu-subject">
              <Input id="lu-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Database Management Systems" />
            </Field>
            <Field label="Semester" htmlFor="lu-sem">
              <Select id="lu-sem" value={semester} onChange={(e) => setSemester(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Faculty" htmlFor="lu-faculty" className="md:col-span-2">
              <Select id="lu-faculty" value={facultyId} onChange={(e) => setFacultyId(e.target.value)}>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.department}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="lu-desc">
            <Textarea id="lu-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the lecture covers and who it is for" />
          </Field>
          <Field label="Video file" htmlFor="lu-file" hint="MP4 or MOV, up to 4 GB. Captions are generated automatically.">
            <label
              htmlFor="lu-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-text-2 hover:border-accent/50"
            >
              <Upload className="h-6 w-6 text-text-3" aria-hidden="true" />
              {fileName || 'Choose a video file'}
              <input
                id="lu-file"
                type="file"
                accept="video/mp4,video/quicktime"
                className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
            </label>
          </Field>
          <div className="overflow-hidden rounded-2xl border border-border">
            <Switch label="Publish to students" description="Off saves a draft visible only to admins and the uploader" checked={publish} onChange={setPublish} />
          </div>
          <Button type="submit" full>
            <Film className="h-4 w-4" aria-hidden="true" />
            {publish ? 'Upload and publish' : 'Save draft'}
          </Button>
          <p className="text-xs text-text-3">Uploader: {college.shortName} Academic Office. Faculty members can see their own lectures here.</p>
        </Card>
      </form>

      <section aria-label="Uploaded lectures" className="space-y-3">
        <SectionHeader title="Library" description={`${items.filter((l) => l.published).length} published · ${items.filter((l) => !l.published).length} draft`} />
        {items.map((lec) => {
          const faculty = getPerson(lec.facultyId);
          return (
            <Card key={lec.id} className="flex items-start gap-3 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
                <Film className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{lec.title}</p>
                <p className="text-xs text-text-3">
                  {faculty.name} · {lec.subject} · Sem {lec.semester}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-text-3">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {lec.views.toLocaleString('en-IN')} views · {relativeTime(lec.uploadedAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={lec.published ? 'success' : 'neutral'}>{lec.published ? 'Published' : 'Draft'}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setItems((list) => list.map((l) => (l.id === lec.id ? { ...l, published: !l.published } : l)));
                    toast(lec.published ? 'Unpublished' : 'Published');
                  }}
                >
                  {lec.published ? 'Unpublish' : 'Publish'}
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
