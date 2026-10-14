import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { soloApi, type SoloEntry } from '../../api/solo';
import { useCurrentUser } from '../../app/auth';
import { useInstallation } from '../../app/installation';
import { useI18n } from '../../app/i18n';
import { dateInZone } from '../../app/solo-time';
import { QueryError } from './SoloUi';
import { SoloWeekPage } from './SoloWeekPage';
import { SoloTimesPage, SoloTimer, EntryDialog } from './SoloTimesPage';
import { entryRange, openMinutesOnDate, shiftDate, useClockNow, weekDates, WorkDuration } from './ClockTime';

export function SoloDashboardPage() {
  const user = useCurrentUser();
  const { t } = useI18n();
  const { data: installation } = useInstallation();
  const zone = installation?.timeZone ?? 'UTC';
  const now = useClockNow();
  const today = dateInZone(zone);
  const week = weekDates(today);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [correcting, setCorrecting] = useState<SoloEntry | null>(null);
  const entries = useQuery({
    queryKey: ['solo-times', user.id, week.from, week.to, zone],
    queryFn: () => soloApi.entries(user.id, entryRange(week.from, week.to, zone)),
    refetchInterval: 30_000,
  });
  const weekReport = useQuery({
    queryKey: ['solo-report', 'week-view', week.from, week.to],
    queryFn: () => soloApi.report(new URLSearchParams(week)),
    refetchInterval: 30_000,
  });
  const summary = useQuery({
    queryKey: ['solo-summary', today],
    queryFn: () => soloApi.summary(undefined, today),
    enabled: Boolean(installation?.capabilities.targets),
    refetchInterval: 30_000,
  });
  const openToday = openMinutesOnDate(entries.data ?? [], today, zone, now);
  const openWeek = Array.from({ length: 7 }, (_, i) => openMinutesOnDate(entries.data ?? [], shiftDate(week.from, i), zone, now)).reduce((a, b) => a + b, 0);
  return <div className="space-y-6">
    <h1 className="text-3xl font-semibold">{t('solo.times')}</h1>
    <QueryError error={entries.error || weekReport.error || summary.error} retry={() => {
      void entries.refetch(); void weekReport.refetch();
      if (summary.isEnabled) void summary.refetch();
    }} />
    <div className={installation?.capabilities.targets ? 'grid grid-cols-2 gap-3' : ''}>
      {entries.isLoading ? <p role="status">{t('common.loading')}</p> : <SoloTimer entries={entries.data ?? []} projects={[]} onCorrect={setCorrecting} />}
      {installation?.capabilities.targets && <Card className="flex items-center"><CardContent className="w-full p-4 sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">{t('solo.flexShort')}</p>
        <p className="mt-2 break-words text-xl font-semibold tabular-nums sm:text-3xl"><WorkDuration value={summary.data?.overtimeMinutes} signed /></p>
      </CardContent></Card>}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <Card><CardContent className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">{t('solo.today')} · {t('solo.workedHours')}</p>
        <p className="mt-2 break-words text-xl font-semibold tracking-tight sm:text-3xl"><WorkDuration value={weekReport.data && weekReport.data.rows.filter((row) => row.date === today).reduce((sum, row) => sum + row.netMinutes, 0) + openToday} /></p>
      </CardContent></Card>
      <div>
        <Card className="h-full"><CardContent className="p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">{t('solo.week')} · {t('solo.workedHours')}</p>
          <p className="mt-2 break-words text-xl font-semibold tracking-tight sm:text-3xl"><WorkDuration value={weekReport.data && weekReport.data.totals.netMinutes + openWeek} /></p>
          
        </CardContent></Card>
      </div>
    </div>
    <SoloWeekPage embedded />
    <details className="rounded-lg border bg-card p-4" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">{t('solo.timeHistory')}</summary>
      {historyOpen && <div className="mt-5"><SoloTimesPage embedded /></div>}
    </details>
    {correcting && <EntryDialog kind="correct" entry={correcting} projects={[]} timeZone={zone} close={() => setCorrecting(null)} />}
  </div>;
}
