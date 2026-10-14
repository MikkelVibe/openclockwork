import { useState } from 'react';
import { BriefcaseBusiness, House, Palmtree, HeartPulse, CalendarDays, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { soloApi, type PersonalDay } from '../../api/solo';
import { useI18n } from '../../app/i18n';
import { dateInZone } from '../../app/solo-time';
import { Field, QueryError } from './SoloUi';

const kindIcons = {
  Work: BriefcaseBusiness,
  Home: House,
  Free: CalendarDays,
  Vacation: Palmtree,
  Sickness: HeartPulse,
  Training: GraduationCap,
};
function DayKindIcon({ kind }: { kind: keyof typeof kindIcons }) {
  const Icon = kindIcons[kind];
  return <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" />;
}
export function SoloMonthCalendar({
  days,
  timeZone,
  onSelectDate,
}: {
  days: PersonalDay[];
  timeZone: string;
  onSelectDate?: (date: string) => void;
}) {
  const { t, languageTag } = useI18n();
  const [month, setMonth] = useState(dateInZone(timeZone).slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leading =
    (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const report = useQuery({
    queryKey: ['solo-report', 'calendar', month],
    queryFn: () =>
      soloApi.report(
        new URLSearchParams({ from: `${month}-01`, to: `${month}-${end}` }),
      ),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });
  const netByDate = new Map<string, number>();
  report.data?.rows.forEach((row) =>
    netByDate.set(row.date, (netByDate.get(row.date) ?? 0) + row.netMinutes),
  );
  const workKinds = new Map<string, Set<'Work' | 'Home'>>();
  report.data?.rows.forEach((row) => {
    const kinds = workKinds.get(row.date) ?? new Set<'Work' | 'Home'>();
    kinds.add(row.activity === 'From home' ? 'Home' : 'Work');
    workKinds.set(row.date, kinds);
  });
  const move = (delta: number) =>
    setMonth(
      new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
        .toISOString()
        .slice(0, 7),
    );
  const monthTitle = new Date(
    Date.UTC(year, monthNumber - 1, 1),
  ).toLocaleDateString(languageTag, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <Card className="month-calendar">
      <CardContent className="space-y-4 p-2 pt-4 sm:p-6 sm:pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label={t('solo.calendarMonth')}>
            <Input
              type="month"
              value={month}
              onChange={(event) => {
                if (event.target.value) setMonth(event.target.value);
              }}
            />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={t('solo.previousMonth')}
              onClick={() => move(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth(dateInZone(timeZone).slice(0, 7))}
            >
              {t('solo.today')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('solo.nextMonth')}
              onClick={() => move(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <QueryError error={report.error} retry={report.refetch} />
        <p className="text-xs text-muted-foreground">
          {t('solo.calendarTimesHint', { timeZone })}
        </p>
        <div role="table" aria-label={monthTitle} className="month-grid -mx-2 sm:mx-0">
          <div className="grid grid-cols-7" role="row">
            {Array.from({ length: 7 }, (_, index) => (
              <div
                role="columnheader"
                className="pb-2 text-center text-xs font-medium text-muted-foreground"
                key={index}
              >
                {new Date(Date.UTC(2024, 0, 1 + index)).toLocaleDateString(
                  languageTag,
                  { weekday: 'short', timeZone: 'UTC' },
                )}
              </div>
            ))}
          </div>
          {Array.from({ length: Math.ceil((leading + end) / 7) }, (_, week) => (
            <div key={week} role="row" className="grid grid-cols-7">
              {Array.from({ length: 7 }, (_, weekday) => {
                const day = week * 7 + weekday - leading + 1;
                if (day < 1 || day > end)
                  return (
                    <div
                      key={weekday}
                      role="cell"
                      className="min-h-20 border border-transparent"
                    />
                  );
                const date = `${month}-${String(day).padStart(2, '0')}`;
                const freeDays = days.filter(
                  (item) =>
                    !item.cancelledAt && item.from <= date && item.to >= date,
                );
                const net = netByDate.get(date);
                const time =
                  net == null
                    ? ''
                    : `${(net / 60).toLocaleString(languageTag, { maximumFractionDigits: 2 })}h`;
                const label = [
                  date,
                  time ? `${t('solo.net')}: ${time}` : '',
                  ...freeDays.map((item) => t(`solo.day.${item.kind}`)),
                  ...[...(workKinds.get(date) ?? [])].map((kind) => t(`solo.day.${kind}`)),
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <div
                    key={weekday}
                    role="cell"
                    aria-label={label}
                    title={label}
                    className={`flex min-h-20 min-w-0 flex-col items-center gap-1 border text-center ${date === dateInZone(timeZone) ? 'border-primary bg-primary/5' : ''}`}
                  >
                    <button type="button" aria-label={label} aria-current={date === dateInZone(timeZone) ? 'date' : undefined} onClick={() => onSelectDate?.(date)} className="calendar-day flex w-full flex-1 flex-col items-center gap-1 py-2 rounded hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <span className="text-sm font-medium">{day}</span>
                    {time && (
                      <span className="text-[10px] tabular-nums sm:text-xs">
                        {time}
                      </span>
                    )}
                    <span className="flex flex-wrap justify-center gap-1">
                      {[...(workKinds.get(date) ?? [])].map((kind) => <DayKindIcon key={kind} kind={kind} />)}
                      {freeDays.map((item) => (
                        <DayKindIcon key={item.id} kind={item.kind} />
                      ))}
                    </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {(['Work', 'Vacation', 'Sickness', 'Home'] as const).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <DayKindIcon kind={kind} />
              {t(`solo.day.${kind}`)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
