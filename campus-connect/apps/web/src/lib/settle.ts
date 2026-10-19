import type { TripExpense } from './types';

/**
 * Net balance per person: positive means they are owed money, negative means they owe.
 * Each expense is split evenly among its `splitWith` people.
 */
export function settle(expenses: TripExpense[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const expense of expenses) {
    const share = expense.amount / Math.max(1, expense.splitWith.length);
    net[expense.paidBy] = (net[expense.paidBy] ?? 0) + expense.amount;
    for (const id of expense.splitWith) net[id] = (net[id] ?? 0) - share;
  }
  return Object.fromEntries(Object.entries(net).map(([id, v]) => [id, Math.round(v)]));
}
