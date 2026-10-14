import type { SoloEntry } from "../../api/solo";
import { entryRange, openMinutesOnDate, weekDates } from "./ClockTime";

describe("personal clock calendar", () => {
  it('bounds entry requests by Copenhagen midnights across DST', () => {
    expect(entryRange('2026-10-25', '2026-10-25', 'Europe/Copenhagen')).toEqual({
      from: '2026-10-24T22:00:00.000Z', to: '2026-10-25T22:59:59.999Z',
    });
  });
  it("keeps Sunday in the week starting on Monday across the year boundary", () => {
    expect(weekDates("2027-01-03")).toEqual({
      from: "2026-12-28",
      to: "2027-01-03",
    });
  });
  it("counts an overnight open session only in its local day", () => {
    const entries = [
      { clockIn: "2026-10-12T21:00:00Z", clockOut: null, voidedAt: null },
    ] as SoloEntry[];
    const now = Date.parse("2026-10-13T06:00:00Z");
    expect(
      openMinutesOnDate(entries, "2026-10-12", "Europe/Copenhagen", now),
    ).toBe(60);
    expect(
      openMinutesOnDate(entries, "2026-10-13", "Europe/Copenhagen", now),
    ).toBe(480);
  });
  it("uses the actual 25-hour Copenhagen day when daylight saving ends", () => {
    const entries = [
      { clockIn: "2026-10-24T22:00:00Z", clockOut: null, voidedAt: null },
    ] as SoloEntry[];
    expect(
      openMinutesOnDate(
        entries,
        "2026-10-25",
        "Europe/Copenhagen",
        Date.parse("2026-10-25T23:00:00Z"),
      ),
    ).toBe(1500);
  });
  it("excludes closed and voided entries from the live contribution", () => {
    const entries = [
      {
        clockIn: "2026-10-13T06:00:00Z",
        clockOut: "2026-10-13T07:00:00Z",
        voidedAt: null,
      },
      {
        clockIn: "2026-10-13T06:00:00Z",
        clockOut: null,
        voidedAt: "2026-10-13T07:00:00Z",
      },
    ] as SoloEntry[];
    expect(
      openMinutesOnDate(
        entries,
        "2026-10-13",
        "Europe/Copenhagen",
        Date.parse("2026-10-13T08:00:00Z"),
      ),
    ).toBe(0);
  });
});
