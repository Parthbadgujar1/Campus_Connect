'use client';

import { useMemo, useState } from 'react';
import { Plus, Wallet, Utensils, Home, Users, Receipt } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UnderlineTabs } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { Card, PageHeader, ProgressBar, SectionHeader, StatTile } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { expenseCategories, expenses as seedExpenses, foodWeek, monthlyBudget, rentMonths, sharedBalances, type Expense, type ExpenseCategory } from '@/data/finance';
import { getPerson } from '@/data/people';
import { NOW, formatDay, relativeTime } from '@/lib/time';
import { formatINR } from '@/lib/visuals';
import { cn } from '@/lib/utils';

type Tab = 'Overview' | 'Expenses' | 'Shared' | 'Rent' | 'Food';

export default function FinancePage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Overview');
  const [items, setItems] = useState<Expense[]>(seedExpenses);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');

  const spent = useMemo(() => items.reduce((sum, e) => sum + e.amount, 0), [items]);
  const remaining = monthlyBudget - spent;
  const pct = Math.round((spent / monthlyBudget) * 100);
  const byCategory = expenseCategories
    .map((c) => ({ category: c, spent: items.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) }))
    .filter((c) => c.spent > 0)
    .sort((a, b) => b.spent - a.spent);
  const maxFood = Math.max(...foodWeek.map((d) => d.amount));
  const owed = sharedBalances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0);
  const oweYou = sharedBalances.filter((b) => b.net < 0).reduce((s, b) => s + -b.net, 0);

  const add = () => {
    const value = Number(amount);
    if (!title.trim() || !(value > 0)) return;
    setItems((list) => [{ id: `new-${Date.now()}`, title: title.trim(), amount: value, category, at: NOW.toISOString() }, ...list]);
    setTitle('');
    setAmount('');
    setAddOpen(false);
    toast('Expense logged');
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader
        title="Finance tools"
        subtitle="Budget, expenses, shared bills and rent"
        back
        backHref="/campus"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        }
      />

      <div className="mt-4">
        <UnderlineTabs<Tab>
          label="Finance sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Overview', label: 'Overview' },
            { value: 'Expenses', label: 'Expenses' },
            { value: 'Shared', label: 'Shared' },
            { value: 'Rent', label: 'Rent' },
            { value: 'Food', label: 'Food' },
          ]}
        />
      </div>

      {tab === 'Overview' && (
        <section className="mt-5 space-y-5">
          <Card className="space-y-4 p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-3">October budget</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">{formatINR(remaining)}</p>
                <p className="text-sm text-text-3">left of {formatINR(monthlyBudget)}</p>
              </div>
              <Badge tone={pct > 90 ? 'danger' : pct > 70 ? 'warning' : 'success'}>{pct}% used</Badge>
            </div>
            <ProgressBar value={spent} max={monthlyBudget} tone={pct > 90 ? 'danger' : pct > 70 ? 'warning' : 'accent'} label="Budget used" />
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Spent this month" value={formatINR(spent)} icon={Wallet} tone="warning" />
            <StatTile label="Transactions" value={items.length} icon={Receipt} />
          </div>

          <Card className="space-y-3 p-5">
            <p className="font-semibold">Where it went</p>
            {byCategory.map((row) => (
              <div key={row.category} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-2">{row.category}</span>
                  <span className="font-semibold">{formatINR(row.spent)}</span>
                </div>
                <ProgressBar value={row.spent} max={spent} label={`${row.category} share`} />
              </div>
            ))}
          </Card>
        </section>
      )}

      {tab === 'Expenses' && (
        <section className="mt-5">
          <Card className="divide-y divide-border">
            {items.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-text-3">
                    {e.category} · {relativeTime(e.at)}
                  </p>
                </div>
                <span className="text-sm font-semibold">−{formatINR(e.amount)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {tab === 'Shared' && (
        <section className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="You are owed" value={formatINR(owed)} tone="success" icon={Users} />
            <StatTile label="You owe" value={formatINR(oweYou)} tone="danger" icon={Users} />
          </div>
          <SectionHeader title="Balances" />
          <Card className="divide-y divide-border">
            {sharedBalances.map((b) => {
              const person = getPerson(b.personId);
              return (
                <div key={b.personId} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar name={person.name} seed={person.id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    <p className="text-xs text-text-3">{b.note}</p>
                  </div>
                  {b.net === 0 ? (
                    <Badge>Settled</Badge>
                  ) : (
                    <span className={cn('text-sm font-semibold', b.net > 0 ? 'text-success' : 'text-danger')}>
                      {b.net > 0 ? `gets ${formatINR(b.net)}` : `owes ${formatINR(-b.net)}`}
                    </span>
                  )}
                </div>
              );
            })}
          </Card>
          <p className="text-xs text-text-3">Settle up on UPI. Mark a balance as settled once the payment is confirmed in chat.</p>
        </section>
      )}

      {tab === 'Rent' && (
        <section className="mt-5 space-y-4">
          <Card className="flex items-center gap-4 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-ink">
              <Home className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Sunrise Boys PG</p>
              <p className="text-sm text-text-3">Due on the 5th of every month</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => toast('Payment reminder sent to flatmates (demo)')}>
              Remind
            </Button>
          </Card>
          <Card className="divide-y divide-border">
            {rentMonths.map((r) => (
              <div key={r.month} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{r.month}</p>
                  <p className="text-xs text-text-3">{formatINR(r.amount)}</p>
                </div>
                {r.status === 'Paid' ? <Badge tone="success">Paid</Badge> : <Button size="sm" onClick={() => toast('Opens UPI to pay (demo)')}>Mark paid</Button>}
              </div>
            ))}
          </Card>
        </section>
      )}

      {tab === 'Food' && (
        <section className="mt-5 space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Food this week</p>
              <span className="flex items-center gap-1 text-xs text-text-3">
                <Utensils className="h-3.5 w-3.5" aria-hidden="true" />
                {formatINR(foodWeek.reduce((s, d) => s + d.amount, 0))}
              </span>
            </div>
            <div className="flex h-40 items-end gap-2" role="img" aria-label="Food spend by day this week">
              {foodWeek.map((d) => (
                <div key={d.day} className="flex h-full flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-semibold text-text-3">₹{d.amount}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-lg bg-warning/80" style={{ height: `${(d.amount / maxFood) * 100}%` }} />
                  </div>
                  <span className="text-xs text-text-3">{d.day}</span>
                </div>
              ))}
            </div>
          </Card>
          <p className="text-sm text-text-3">
            Tip: the mess advance covers weekday lunches. Weekend food is where most of the budget goes.
          </p>
        </section>
      )}

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Log an expense"
        footer={
          <Button full disabled={!title.trim() || !(Number(amount) > 0)} onClick={add}>
            Save expense
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="What did you spend on?" htmlFor="fx-title">
            <Input id="fx-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Coffee with project team" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount (₹)" htmlFor="fx-amount">
              <Input id="fx-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="180" />
            </Field>
            <Field label="Category" htmlFor="fx-cat">
              <Select id="fx-cat" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {expenseCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-text-3">Logged for {formatDay(NOW.toISOString())} · only you can see personal expenses.</p>
        </div>
      </Sheet>
    </div>
  );
}
