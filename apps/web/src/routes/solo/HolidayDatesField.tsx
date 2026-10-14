import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '../../app/i18n';
import { Field } from './SoloUi';

export function HolidayDatesField({ dates, onChange }: { dates: string[]; onChange: (dates: string[]) => void }) {
  const { t, formatDate } = useI18n();
  const [date, setDate] = useState('');
  const add = () => {
    if (!date || dates.includes(date)) return;
    onChange([...dates, date].sort());
    setDate('');
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t('employees.holidayDates')}</legend>
      <p className="text-xs text-muted-foreground">{t('solo.customHolidayHint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1"><Field label={t('solo.holidayDate')}><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field></div>
        <Button type="button" variant="outline" disabled={!date || dates.includes(date)} onClick={add}>{t('solo.addHoliday')}</Button>
      </div>
      {dates.length ? <ul className="space-y-2">
        {dates.map((value) => <li key={value} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <time dateTime={value}>{formatDate(value)}</time>
          <Button type="button" variant="ghost" aria-label={`${t('common.remove')} ${formatDate(value)}`} onClick={() => onChange(dates.filter((item) => item !== value))}>{t('common.remove')}</Button>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{t('solo.noCustomHolidays')}</p>}
    </fieldset>
  );
}
