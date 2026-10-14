import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { soloApi, type SoloEntry } from '../../api/solo';
import { useCurrentUser } from '../../app/auth';
import { useInstallation } from '../../app/installation';
import { useI18n } from '../../app/i18n';
import { dateInZone, localCandidates, zonedInput } from '../../app/solo-time';
import { EntryDialog } from './SoloTimesPage';
import { QueryError } from './SoloUi';
import { entryRange, openMinutesOnDate, shiftDate, useClockNow, weekDates, WorkDuration } from './ClockTime';

export function SoloWeekPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, languageTag } = useI18n();
  const user = useCurrentUser();
  const installation = useInstallation().data;
  const zone = installation?.timeZone ?? 'UTC';
  const now = useClockNow();
  const [selected, setSelected] = useState(dateInZone(zone));
  const week = weekDates(selected);
  const [editing, setEditing] = useState<{ kind: 'manual' | 'correct'; entry?: SoloEntry; date?: string } | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const report = useQuery({
    queryKey: ['solo-report', 'week-view', week.from, week.to],
    queryFn: () => soloApi.report(new URLSearchParams(week)),
    refetchInterval: 30_000,
  });
  const entries = useQuery({
    queryKey: ['solo-times', user.id, week.from, week.to, zone],
    queryFn: () => soloApi.entries(user.id, entryRange(week.from, week.to, zone)),
    refetchInterval: 30_000,
  });
  const credits = useQuery({
    queryKey: ['solo-summary', week.from, week.to],
    queryFn: () => soloApi.summary(week.from, week.to),
    enabled: Boolean(installation?.capabilities.targets),
    staleTime: 30_000,
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(week.from, i);
    const closed = report.data?.rows.filter((row) => row.date === date).reduce((total, row) => total + row.netMinutes, 0) ?? 0;
    const start = Date.parse(localCandidates(`${date}T00:00`, zone)[0]);
    const end = Date.parse(localCandidates(`${shiftDate(date, 1)}T00:00`, zone)[0]);
    const sessions = (entries.data ?? []).filter((entry) => !entry.voidedAt && Date.parse(entry.clockIn) < end && (entry.clockOut ? Date.parse(entry.clockOut) : now) > start).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    return { date, sessions, credit: credits.data?.dailyCredits?.find((item) => item.date === date), minutes: closed + openMinutesOnDate(entries.data ?? [], date, zone, now) };
  });
  const openDay = (day: (typeof days)[number]) => {
    if (day.sessions.length === 0) setEditing({ kind: 'manual', date: day.date });
    else if (day.sessions.length === 1) setEditing({ kind: 'correct', entry: day.sessions[0] });
    else setEditingDay(day.date);
  };
  const format = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(languageTag, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  const clockTime = (instant: string, date: string) => new Date(instant).toLocaleString(languageTag, {
    timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    ...(zonedInput(instant, zone).slice(0, 10) !== date ? { weekday: 'short' as const } : {}),
  });
  return <div className="space-y-6">
    <h2 className="text-2xl font-semibold">{t('solo.weekView')}</h2>
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('solo.weekContaining')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={t('solo.weekContaining')} className="h-11 w-full rounded-full border-transparent bg-card px-4 text-sm sm:w-44" type="date" value={selected} onChange={(event) => { if (event.target.value) setSelected(event.target.value); }} />
        <Button className="h-11 w-11 shrink-0" variant="outline" aria-label={t('solo.previousWeek')} onClick={() => setSelected(shiftDate(selected, -7))}>‹</Button>
        <Button className="h-11 flex-1 px-5 sm:flex-none" variant="outline" onClick={() => setSelected(dateInZone(zone))}>{t('solo.week')}</Button>
        <Button className="h-11 w-11 shrink-0" variant="outline" aria-label={t('solo.nextWeek')} onClick={() => setSelected(shiftDate(selected, 7))}>›</Button>
      </div>
    </div>
    <p className="text-sm text-muted-foreground">{format(week.from)} – {format(week.to)}</p>
    <QueryError error={report.error || entries.error || credits.error} retry={() => { void report.refetch(); void entries.refetch(); void credits.refetch(); }} />
    {!embedded && <Card><CardContent className="pt-5">
      <p className="text-sm text-muted-foreground">{t('solo.workedHours')}</p>
      <p className="text-3xl font-semibold"><WorkDuration value={report.data && days.reduce((total, day) => total + day.minutes, 0)} /></p>
    </CardContent></Card>}
    {report.isLoading && <p role="status">{t('common.loading')}</p>}
    <div className="week-cards grid auto-cols-[minmax(10rem,44%)] grid-flow-col gap-3 overflow-x-auto snap-x snap-mandatory pb-1 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-7 lg:overflow-visible">
      {days.map((day) => <article key={day.date} aria-label={format(day.date)} className={`relative flex snap-start min-w-0 min-h-36 flex-col items-start justify-between gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent sm:p-4 ${day.date === dateInZone(zone) ? 'border-primary bg-accent ring-1 ring-primary' : ''}`}>
        <button type="button" className="absolute inset-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" aria-label={format(day.date)} onClick={() => openDay(day)} />
        <span className={`pointer-events-none relative ${day.date === dateInZone(zone) ? 'font-semibold' : ''}`}>{format(day.date)}</span>
        {day.credit && <div className="pointer-events-none relative text-xs leading-relaxed">
          <p className="font-semibold">{day.credit.kinds.map((kind) => t(`solo.day.${kind}`)).join(' · ')}</p>
          <p>{t('solo.credited')}: <WorkDuration value={day.credit.minutes} /></p>
        </div>}
        <div className="pointer-events-none relative w-full flex-1 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground"><span>{t('solo.clockInShort')}</span><span>{t('solo.clockOutShort')}</span></div>
          {day.sessions.map((entry) => <button type="button" key={entry.id} onClick={() => setEditing({ kind: 'correct', entry })} aria-label={`${t('solo.correct')} · ${format(day.date)} · ${clockTime(entry.clockIn, day.date)} – ${entry.clockOut ? clockTime(entry.clockOut, day.date) : t('solo.clockOutOpen')}`} className="pointer-events-auto relative grid min-h-11 w-full grid-cols-2 items-center gap-2 rounded border border-transparent px-1 text-left font-mono tabular-nums hover:border-border hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <time dateTime={entry.clockIn}>{clockTime(entry.clockIn, day.date)}</time>
            {entry.clockOut ? <time dateTime={entry.clockOut}>{clockTime(entry.clockOut, day.date)}</time> : <span>{t('solo.clockOutOpen')}</span>}
          </button>)}
          {day.sessions.length === 0 && <div className="grid grid-cols-2 gap-2 text-muted-foreground"><span>—</span><span>—</span></div>}
        </div>
        <span className="pointer-events-none relative whitespace-nowrap text-sm font-semibold tabular-nums"><WorkDuration value={report.data ? day.minutes : undefined} /></span>
      </article>)}
    </div>
    {editingDay && <Dialog open onOpenChange={(open) => { if (!open) setEditingDay(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{format(editingDay)}</DialogTitle><DialogDescription>{t('solo.editDayHint')}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {days.find((day) => day.date === editingDay)?.sessions.map((entry) => <Button key={entry.id} variant="outline" className="h-auto min-h-11 w-full justify-between gap-3" onClick={() => setEditing({ kind: 'correct', entry })}>
            <span className="font-mono">{clockTime(entry.clockIn, editingDay)} – {entry.clockOut ? clockTime(entry.clockOut, editingDay) : t('solo.clockOutOpen')}</span>
            <span>{t('solo.correct')}</span>
          </Button>)}
          {!days.find((day) => day.date === editingDay)?.sessions.length && <p className="text-sm text-muted-foreground">{t('solo.noEntries')}</p>}
          <Button onClick={() => setEditing({ kind: 'manual', date: editingDay })}>{t('solo.manual')}</Button>
        </div>
      </DialogContent>
    </Dialog>}
    {editing && <EntryDialog key={editing.entry?.id ?? editing.date} kind={editing.kind} entry={editing.entry} initialDate={editing.date} projects={[]} timeZone={zone} close={() => setEditing(null)} />}
  </div>;
}
