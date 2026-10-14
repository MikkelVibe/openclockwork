import { useEffect, useState } from "react";
import type { SoloEntry } from "../../api/solo";
import { localCandidates } from "../../app/solo-time";

export function useClockNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function weekDates(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const from = shiftDate(date, -((day + 6) % 7));
  return { from, to: shiftDate(from, 6) };
}
export function entryRange(from: string, to: string, zone: string) {
  return {
    from: localCandidates(`${from}T00:00`, zone)[0],
    to: new Date(Date.parse(localCandidates(`${shiftDate(to, 1)}T00:00`, zone)[0]) - 1).toISOString(),
  };
}
// Count only the portion of an open session inside this local calendar day.
export function openMinutesOnDate(
  entries: SoloEntry[],
  date: string,
  zone: string,
  now: number,
) {
  const open = entries.filter((entry) => !entry.clockOut && !entry.voidedAt);
  if (!open.length) return 0;
  const from = Date.parse(localCandidates(`${date}T00:00`, zone)[0]);
  const to = Date.parse(
    localCandidates(`${shiftDate(date, 1)}T00:00`, zone)[0],
  );
  return open.reduce(
    (total, entry) =>
      total +
      Math.max(
        0,
        Math.min(now, to) - Math.max(Date.parse(entry.clockIn), from),
      ) /
        60_000,
    0,
  );
}
export function WorkDuration({
  value,
  signed = false,
}: {
  value: number | null | undefined;
  signed?: boolean;
}) {
  if (value == null) return <>—</>;
  const minutes = Math.floor(Math.abs(value));
  const sign = value < 0 ? "−" : signed ? "+" : "";
  return (
    <span className="inline-flex max-w-full flex-wrap gap-x-[0.25em]">
      <span>{sign}{Math.floor(minutes / 60)} h</span>{' '}
      <span>{String(minutes % 60).padStart(2, "0")} min</span>
    </span>
  );
}
