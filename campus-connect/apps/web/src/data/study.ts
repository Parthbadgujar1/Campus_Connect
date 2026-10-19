// Study tools: notes and flashcard decks (mock data for the UI phase).

export interface Note {
  id: string;
  title: string;
  body: string;
  subject: string;
  updatedAt: string;
  pinned: boolean;
}

export const seedNotes: Note[] = [
  {
    id: 'note-normal',
    title: 'Normalisation in one page',
    body: '1NF: atomic values, no repeating groups.\n2NF: 1NF + no partial dependency on part of a composite key.\n3NF: 2NF + no transitive dependency.\nBCNF: every determinant is a candidate key.\n\nViva tip: always explain with the student–course–teacher example.',
    subject: 'DBMS',
    updatedAt: '2026-10-13T18:20:00+05:30',
    pinned: true,
  },
  {
    id: 'note-deadlock',
    title: 'Deadlock conditions',
    body: 'Mutual exclusion, hold and wait, no preemption, circular wait.\nBreak any one to prevent deadlock. Banker’s algorithm avoids unsafe states.',
    subject: 'Operating Systems',
    updatedAt: '2026-10-12T21:05:00+05:30',
    pinned: false,
  },
  {
    id: 'note-hackathon',
    title: 'Hackathon checklist',
    body: '• Charger + extension board\n• Repo created, README stub\n• Demo script by 6 AM\n• Sleep 2 hours max, honestly',
    subject: 'Personal',
    updatedAt: '2026-10-14T08:40:00+05:30',
    pinned: false,
  },
];

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface Deck {
  id: string;
  title: string;
  subject: string;
  hue: string;
  cards: Flashcard[];
}

export const decks: Deck[] = [
  {
    id: 'deck-dbms',
    title: 'DBMS viva essentials',
    subject: 'DBMS',
    hue: 'deck-dbms',
    cards: [
      { id: 'd1', front: 'What makes a relation BCNF?', back: 'For every functional dependency X → Y, X is a superkey.' },
      { id: 'd2', front: 'ACID stands for…', back: 'Atomicity, Consistency, Isolation, Durability.' },
      { id: 'd3', front: 'Difference between a primary key and a unique key?', back: 'Primary key: one per table, never null. Unique key: can be many, may allow one null.' },
      { id: 'd4', front: 'What is a dirty read?', back: 'Reading uncommitted changes from another transaction.' },
      { id: 'd5', front: 'Which isolation level prevents phantom reads?', back: 'Serializable.' },
    ],
  },
  {
    id: 'deck-os',
    title: 'Operating systems — scheduling',
    subject: 'Operating Systems',
    hue: 'deck-os',
    cards: [
      { id: 'o1', front: 'What does Round Robin use to switch processes?', back: 'A fixed time quantum.' },
      { id: 'o2', front: 'Which scheduling algorithm can cause starvation?', back: 'Shortest Job First (and priority scheduling without ageing).' },
      { id: 'o3', front: 'What is thrashing?', back: 'Spending more time paging than executing, because working sets do not fit in memory.' },
      { id: 'o4', front: 'Four conditions for deadlock?', back: 'Mutual exclusion, hold and wait, no preemption, circular wait.' },
    ],
  },
  {
    id: 'deck-ml',
    title: 'ML basics',
    subject: 'Machine Learning',
    hue: 'deck-ml',
    cards: [
      { id: 'm1', front: 'Bias–variance trade-off in one line?', back: 'Simple models underfit (high bias); complex models overfit (high variance).' },
      { id: 'm2', front: 'What does L1 regularisation encourage?', back: 'Sparse weights — some become exactly zero.' },
      { id: 'm3', front: 'Precision vs recall?', back: 'Precision: of predicted positives, how many are right. Recall: of actual positives, how many were found.' },
    ],
  },
];
