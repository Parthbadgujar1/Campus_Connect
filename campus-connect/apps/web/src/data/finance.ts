import { daysAgo, hoursAgo } from '@/lib/time';

// Student finance tools (module 46), shared expenses (23) and rent tracking (49).

export const expenseCategories = ['Food', 'Travel', 'Stationery', 'Rent', 'Fun', 'Health', 'Other'] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  at: string;
}

export const monthlyBudget = 9000;

export const expenses: Expense[] = [
  { id: 'ex-1', title: 'Thali Express (lunch)', amount: 140, category: 'Food', at: hoursAgo(3) },
  { id: 'ex-2', title: 'Printouts for DBMS record', amount: 180, category: 'Stationery', at: daysAgo(1) },
  { id: 'ex-3', title: 'Shirdi train share', amount: 480, category: 'Travel', at: daysAgo(2) },
  { id: 'ex-4', title: 'Hostel mess advance', amount: 1800, category: 'Food', at: daysAgo(3) },
  { id: 'ex-5', title: 'Movie + popcorn', amount: 320, category: 'Fun', at: daysAgo(4) },
  { id: 'ex-6', title: 'Cold brew & sandwich', amount: 260, category: 'Food', at: daysAgo(5) },
  { id: 'ex-7', title: 'Pharmacy', amount: 210, category: 'Health', at: daysAgo(6) },
];

export const sharedBalances: { personId: string; net: number; note: string }[] = [
  { personId: 'p-kunal', net: -480, note: 'Cab split · Shirdi' },
  { personId: 'p-sneha', net: 620, note: 'Groceries for the flat' },
  { personId: 'p-shruti', net: 0, note: 'Settled up' },
];

export const rentMonths = [
  { month: 'Aug 2026', amount: 6500, status: 'Paid' as const },
  { month: 'Sep 2026', amount: 6500, status: 'Paid' as const },
  { month: 'Oct 2026', amount: 6500, status: 'Due' as const },
];

export const foodWeek = [
  { day: 'Mon', amount: 240 },
  { day: 'Tue', amount: 180 },
  { day: 'Wed', amount: 320 },
  { day: 'Thu', amount: 150 },
  { day: 'Fri', amount: 410 },
  { day: 'Sat', amount: 290 },
  { day: 'Sun', amount: 120 },
];
