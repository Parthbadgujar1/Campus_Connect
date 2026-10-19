'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CalendarRange, MessageCircle, Plus, Receipt, Users, Wallet } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Segmented } from '@/components/ui/chip';
import { Field, Input, Select } from '@/components/ui/fields';
import { Card, DetailHero, EmptyState, MetaLine, PageHeader, ProgressBar, SectionHeader } from '@/components/ui/layout';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { trips } from '@/data/living';
import { getPerson } from '@/data/people';
import type { Trip, TripExpense } from '@/lib/types';
import { settle } from '@/lib/settle';
import { formatDay, formatRange } from '@/lib/time';
import { formatINR } from '@/lib/visuals';
import { cn } from '@/lib/utils';

type Tab = 'Plan' | 'Members' | 'Expenses';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const found = trips.find((t) => t.id === id);
  if (!found) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <PageHeader title="Trip" back backHref="/travel" />
        <EmptyState icon={Users} title="This trip is no longer listed" className="mt-6" />
      </div>
    );
  }
  return <TripView key={found.id} trip={found} />;
}

function TripView({ trip }: { trip: Trip }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Plan');
  const [expenses, setExpenses] = useState<TripExpense[]>(trip.expenses);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TripExpense['category']>('Transport');

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const balances = useMemo(() => settle(expenses), [expenses]);
  const seatsLeft = trip.seats - trip.seatsTaken;
  const others = trip.memberIds.filter((id) => id !== 'me');

  const addExpense = () => {
    const value = Number(amount);
    if (!title.trim() || !(value > 0)) return;
    setExpenses((list) => [
      ...list,
      { id: `new-${Date.now()}`, title: title.trim(), amount: value, paidBy: 'me', splitWith: trip.memberIds, category },
    ]);
    setTitle('');
    setAmount('');
    setAddOpen(false);
    toast('Expense added and split with the group');
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title={trip.destination} subtitle={`${trip.purpose} · ${trip.transport}`} back backHref="/travel" />

      <div className="mt-2 space-y-5 md:mt-4">
        <DetailHero seed={trip.id} icon={CalendarRange} eyebrow={trip.purpose} title={`${trip.from} → ${trip.destination}`}>
          <MetaLine icon={CalendarRange}>{formatRange(trip.departs, trip.returns)}</MetaLine>
          <MetaLine icon={Wallet}>About {formatINR(trip.budget)} per person</MetaLine>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-text-3">
              <span>{seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left` : 'Full'}</span>
              <span>
                {trip.seatsTaken}/{trip.seats}
              </span>
            </div>
            <ProgressBar value={trip.seatsTaken} max={trip.seats} label="Seats taken" />
          </div>
        </DetailHero>

        {trip.chatId && (
          <Link href={`/chats/${trip.chatId}`} className={buttonClass({ variant: 'secondary', full: true })}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Open trip group chat
          </Link>
        )}

        <Segmented<Tab>
          label="Trip sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'Plan', label: 'Plan' },
            { value: 'Members', label: 'Members', count: trip.memberIds.length },
            { value: 'Expenses', label: 'Expenses' },
          ]}
        />

        {tab === 'Plan' && (
          <Card className="space-y-4 p-5">
            <SectionHeader title="Itinerary" />
            <ol className="space-y-3">
              {trip.itinerary.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-soft-ink">{i + 1}</span>
                  <span className="pt-0.5 text-text-2">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {tab === 'Members' && (
          <Card className="divide-y divide-border px-4">
            {trip.memberIds.map((memberId) => {
              const person = getPerson(memberId);
              return (
                <div key={memberId} className="flex items-center gap-3 py-3">
                  <Avatar name={memberId === 'me' ? 'Riya Deshmukh' : person.name} seed={person.id} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{memberId === 'me' ? 'You' : person.name}</span>
                  {memberId === trip.organizerId && <Badge tone="accent">Organiser</Badge>}
                </div>
              );
            })}
          </Card>
        )}

        {tab === 'Expenses' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-text-3">Total spent</p>
                <p className="mt-1 text-xl font-bold">{formatINR(total)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-text-3">Your share</p>
                <p className="mt-1 text-xl font-bold">{formatINR(Math.round(total / Math.max(1, trip.memberIds.length)))}</p>
              </Card>
            </div>

            <div>
              <SectionHeader title="Settle up" description="Based on who paid and who shares each cost" />
              <Card className="divide-y divide-border">
                {Object.entries(balances).length === 0 && <p className="p-4 text-sm text-text-3">No expenses yet.</p>}
                {Object.entries(balances).map(([id, value]) => {
                  const name = id === 'me' ? 'You' : getPerson(id).name.split(' ')[0];
                  return (
                    <div key={id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-medium">{name}</span>
                      <span className={cn('font-semibold', value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-text-3')}>
                        {value > 0 ? `gets ${formatINR(value)}` : value < 0 ? `owes ${formatINR(-value)}` : 'settled'}
                      </span>
                    </div>
                  );
                })}
              </Card>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[17px] font-semibold">Expenses</p>
                <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </div>
              <Card className="divide-y divide-border">
                {expenses.length === 0 && <p className="p-4 text-sm text-text-3">Add the first ticket or room cost.</p>}
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-text-2">
                      <Receipt className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-text-3">
                        {e.category} · paid by {e.paidBy === 'me' ? 'you' : getPerson(e.paidBy).name.split(' ')[0]} · split {e.splitWith.length} ways
                      </p>
                    </div>
                    <span className="text-sm font-semibold">{formatINR(e.amount)}</span>
                  </div>
                ))}
              </Card>
            </div>
            <p className="text-xs text-text-3">
              Trip starts {formatDay(trip.departs)}. {others.length} others are in this group. Settle through UPI or cash after the trip.
            </p>
          </div>
        )}
      </div>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add an expense"
        description={`Split evenly between ${trip.memberIds.length} people`}
        footer={
          <Button full disabled={!title.trim() || !(Number(amount) > 0)} onClick={addExpense}>
            Save expense
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="What was it?" htmlFor="ex-title">
            <Input id="ex-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cab from station" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount (₹)" htmlFor="ex-amount">
              <Input id="ex-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="800" />
            </Field>
            <Field label="Category" htmlFor="ex-cat">
              <Select id="ex-cat" value={category} onChange={(e) => setCategory(e.target.value as TripExpense['category'])}>
                <option>Transport</option>
                <option>Stay</option>
                <option>Food</option>
                <option>Other</option>
              </Select>
            </Field>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
