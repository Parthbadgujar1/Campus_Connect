// Hush: anonymous questions and answers, in the spirit of a Q&A board. Authors can stay hidden.
import { daysAgo, hoursAgo } from '@/lib/time';
import { getPerson, me } from './people';

export interface HushAnswer {
  id: string;
  body: string;
  authorId: string | 'anonymous';
  votes: number;
  accepted?: boolean;
  at: string;
}

export interface HushQuestion {
  id: string;
  topic: string;
  body: string;
  authorId: string | 'anonymous';
  votes: number;
  at: string;
  answers: HushAnswer[];
}

export const hushTopics = ['DBMS', 'Operating Systems', 'Machine Learning', 'Placements', 'Hostel life', 'Hackathons', 'Finance', 'Design'];

export const hushQuestions: HushQuestion[] = [
  {
    id: 'hq-normal',
    topic: 'DBMS',
    body: 'When is a table in BCNF but not 4NF? Trying to explain it in the viva without mixing the two up.',
    authorId: 'anonymous',
    votes: 46,
    at: hoursAgo(5),
    answers: [
      { id: 'ha-1', body: 'BCNF only looks at functional dependencies. 4NF also handles multivalued ones. A table with two independent multivalued facts about one key is the classic case: in BCNF, but not in 4NF.', authorId: 'f-anita', votes: 38, accepted: true, at: hoursAgo(4) },
      { id: 'ha-2', body: 'Think of course and skill for an employee. If an employee has several courses and several skills that don’t depend on each other, you need to split them.', authorId: 'anonymous', votes: 12, at: hoursAgo(3) },
    ],
  },
  {
    id: 'hq-deadlock',
    topic: 'Operating Systems',
    body: 'Is the banker’s algorithm used in real OS kernels, or only in textbooks?',
    authorId: 'p-tanvi',
    votes: 21,
    at: daysAgo(1),
    answers: [
      { id: 'ha-3', body: 'Mostly textbooks. Real kernels avoid deadlock by ordering locks and detecting it, because the banker’s check needs every process to declare its maximum need up front.', authorId: 'p-vishwajeet', votes: 19, accepted: true, at: daysAgo(1) },
    ],
  },
  {
    id: 'hq-ml',
    topic: 'Machine Learning',
    body: 'My validation loss goes down but the test accuracy stays flat. Overfitting or a data leak?',
    authorId: 'anonymous',
    votes: 33,
    at: hoursAgo(9),
    answers: [
      { id: 'ha-4', body: 'Check the split first. If you scaled or imputed before splitting, that is a leak. Fit the scaler on the training fold only.', authorId: 'p-tanvi', votes: 27, at: hoursAgo(8) },
    ],
  },
  {
    id: 'hq-placement',
    topic: 'Placements',
    body: 'For the first drive, is it worth applying to companies with a bond? Looking for honest experiences.',
    authorId: 'p-rohan',
    votes: 17,
    at: daysAgo(2),
    answers: [],
  },
  {
    id: 'hq-hostel',
    topic: 'Hostel life',
    body: 'Which hostel has the fastest Wi-Fi during exam week? Need it for online tests.',
    authorId: 'anonymous',
    votes: 9,
    at: hoursAgo(2),
    answers: [],
  },
  {
    id: 'hq-hack',
    topic: 'Hackathons',
    body: 'Do we need our own laptops for the GPU track, or are there lab machines?',
    authorId: 'p-harsh',
    votes: 14,
    at: hoursAgo(12),
    answers: [
      { id: 'ha-5', body: 'Lab machines have one shared GPU each. Bring your own if you want to iterate fast.', authorId: 'p-pooja', votes: 8, at: hoursAgo(10) },
    ],
  },
];

export function getHushQuestion(id: string): HushQuestion | undefined {
  return hushQuestions.find((question) => question.id === id);
}

/** Display name for an author id. Anonymous authors never get a name. */
export function authorName(id: string): string {
  return id === 'anonymous' ? 'Anonymous' : id === 'me' ? me.name : getPerson(id).name;
}
