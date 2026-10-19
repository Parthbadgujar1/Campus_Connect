// Playroom: live tables where people play together, with voice or chat.
export interface PlayTable {
  id: string;
  game: string;
  hostId: string;
  seats: number;
  taken: number;
  playerIds: string[];
  voice: boolean;
  status: 'Waiting' | 'Playing';
  note: string;
}

export const playTables: PlayTable[] = [
  { id: 'tb-smash', game: 'Smash bracket', hostId: 'p-harsh', seats: 8, taken: 5, playerIds: ['p-harsh', 'p-kunal', 'p-aryan', 'p-sanket', 'p-shruti'], voice: true, status: 'Waiting', note: 'Single elimination. Seeds by last month.' },
  { id: 'tb-trivia', game: 'Trivia night', hostId: 'p-tanvi', seats: 10, taken: 7, playerIds: ['p-tanvi', 'p-rohan', 'p-neha', 'p-omkar', 'p-diya', 'p-sneha', 'p-aditi'], voice: false, status: 'Playing', note: 'Round 3 of 5. Join and catch up in one round.' },
  { id: 'tb-codenames', game: 'Word duel', hostId: 'p-pooja', seats: 6, taken: 2, playerIds: ['p-pooja', 'p-vishwajeet'], voice: true, status: 'Waiting', note: 'Two teams of three. Voice on, camera off.' },
];
