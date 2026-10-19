// Lecture library: videos uploaded by teachers and the office, plus links to YouTube or other platforms.
import { lectures } from './learning';
import { getPerson } from './people';

export type LectureSource = 'Uploaded' | 'YouTube' | 'Other link';

export interface LectureItem {
  id: string;
  title: string;
  subject: string;
  semester: number;
  teacherId: string;
  source: LectureSource;
  durationMin: number;
  views: number;
  uploadedAt: string;
  /** Internal player route for uploads, or the external link for everything else. */
  href: string;
  external: boolean;
  seed: string;
}

const uploaded: LectureItem[] = lectures
  .filter((lecture) => lecture.published)
  .map((lecture) => ({
    id: lecture.id,
    title: lecture.title,
    subject: lecture.subject,
    semester: lecture.semester,
    teacherId: lecture.facultyId,
    source: 'Uploaded',
    durationMin: lecture.durationMin,
    views: lecture.views,
    uploadedAt: lecture.uploadedAt,
    href: `/watch/v/${lecture.id}`,
    external: false,
    seed: lecture.seed,
  }));

const linked: LectureItem[] = [
  { id: 'yt-dbms-normal', title: 'Normal forms explained with a library example', subject: 'DBMS', semester: 6, teacherId: 'f-anita', source: 'YouTube', durationMin: 17, views: 8420, uploadedAt: '2026-10-10T09:00:00+05:30', href: 'https://www.youtube.com/results?search_query=normal+forms+dbms', external: true, seed: 'yt-dbms' },
  { id: 'yt-os-deadlock', title: 'Deadlock in 12 minutes', subject: 'Operating Systems', semester: 6, teacherId: 'f-manoj', source: 'YouTube', durationMin: 12, views: 15300, uploadedAt: '2026-10-08T09:00:00+05:30', href: 'https://www.youtube.com/results?search_query=deadlock+operating+system', external: true, seed: 'yt-os' },
  { id: 'ol-ml-course', title: 'Regularisation and bias–variance, with notebooks', subject: 'Machine Learning', semester: 6, teacherId: 'f-neha', source: 'Other link', durationMin: 45, views: 1290, uploadedAt: '2026-10-05T09:00:00+05:30', href: 'https://developers.google.com/machine-learning/crash-course', external: true, seed: 'ol-ml' },
];

export const lectureLibrary: LectureItem[] = [...uploaded, ...linked].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

export const lectureSubjects = [...new Set(lectureLibrary.map((lecture) => lecture.subject))].sort();

export function teacherName(id: string): string {
  return getPerson(id).name;
}
