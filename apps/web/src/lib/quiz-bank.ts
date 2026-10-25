// Questions for the Playroom tech trivia. Each round picks five at random.

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

export const QUIZ_BANK: QuizQuestion[] = [
  { q: 'Which normal form removes transitive dependencies?', options: ['1NF', '2NF', '3NF', 'BCNF'], answer: 2 },
  { q: 'What does the banker’s algorithm avoid?', options: ['Page faults', 'Deadlock', 'Starvation of I/O', 'Cache misses'], answer: 1 },
  { q: 'Which data structure does breadth-first search use?', options: ['Stack', 'Queue', 'Heap', 'Trie'], answer: 1 },
  { q: 'In React, which hook memoises an expensive value?', options: ['useEffect', 'useRef', 'useMemo', 'useId'], answer: 2 },
  { q: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], answer: 1 },
  { q: 'Which HTTP status code means “Not Found”?', options: ['200', '301', '404', '500'], answer: 2 },
  { q: 'Which layer of the OSI model does a router work at?', options: ['Physical', 'Data link', 'Network', 'Transport'], answer: 2 },
  { q: 'What does SQL’s GROUP BY usually go with?', options: ['An aggregate like COUNT', 'A trigger', 'An index', 'A view'], answer: 0 },
  { q: 'Which sorting algorithm has the best worst-case time?', options: ['Quick sort', 'Merge sort', 'Bubble sort', 'Insertion sort'], answer: 1 },
  { q: 'In Git, which command creates a new branch and switches to it?', options: ['git branch -d', 'git switch -c', 'git merge', 'git stash'], answer: 1 },
  { q: 'What does CPU scheduling “round robin” rely on?', options: ['Priorities', 'A time quantum', 'Job length', 'Arrival order only'], answer: 1 },
  { q: 'Which of these is not a JavaScript primitive?', options: ['string', 'symbol', 'array', 'bigint'], answer: 2 },
  { q: 'Which protocol resolves domain names to IP addresses?', options: ['DHCP', 'DNS', 'ARP', 'FTP'], answer: 1 },
  { q: 'A stack follows which order?', options: ['FIFO', 'LIFO', 'Random', 'Priority'], answer: 1 },
  { q: 'Which Python keyword defines a function?', options: ['func', 'def', 'fn', 'lambda only'], answer: 1 },
  { q: 'What does ACID’s “I” stand for?', options: ['Integrity', 'Isolation', 'Indexing', 'Iteration'], answer: 1 },
];

export function pickQuestions(n = 5): QuizQuestion[] {
  const pool = [...QUIZ_BANK];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}
