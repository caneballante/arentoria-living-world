/**
 * Generic campaign calendar. The engine knows nothing about specific month names or
 * festivals; those come from a CalendarConfig supplied by the world definition.
 *
 * Time is tracked as an absolute integer day index. Day 0 is the first day of the
 * first month of `epochYear`. The weekday cycle runs continuously through every day,
 * including intercalary days (a design choice that is easy to revisit).
 */

import type { Provenance } from "./provenance";

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface MonthConfig {
  name: string;
  days: number;
  season: Season;
}

export interface IntercalaryConfig {
  name: string;
  /** Placed after this 1-based month number. */
  afterMonth: number;
  season: Season;
}

export interface FestivalConfig {
  id: string;
  name: string;
  provenance: Provenance;
  /** 1-based month number, or null if the festival is an intercalary day. */
  month: number | null;
  /** 1-based first day of month (ignored for intercalary festivals). */
  day: number;
  durationDays: number;
  /** Intercalary day name, when month is null. */
  intercalary?: string;
  /** Demand multipliers keyed by neighborhood id; "*" is the default. */
  demandMultiplier: Record<string, number>;
  description: string;
}

export interface CalendarConfig {
  id: string;
  label: string;
  provenance: Provenance;
  eraSuffix: string;
  epochYear: number;
  weekdayNames: string[];
  /** Weekday index (0-based) on absolute day 0. */
  epochWeekday: number;
  months: MonthConfig[];
  intercalary: IntercalaryConfig[];
  /** Weekday indices that are market days. */
  marketDays: number[];
  /** Weekday index of the customary rest day (or -1). */
  restDay: number;
  festivals: FestivalConfig[];
}

export interface CalendarDate {
  absoluteDay: number;
  year: number;
  /** 0-based day of year. */
  dayOfYear: number;
  /** 1-based month number; null on intercalary days. */
  month: number | null;
  monthName: string;
  /** 1-based day of month (1 on intercalary days). */
  dayOfMonth: number;
  intercalary: string | null;
  weekday: number;
  weekdayName: string;
  season: Season;
  isMarketDay: boolean;
  isRestDay: boolean;
  festivals: FestivalConfig[];
}

interface Segment {
  kind: "month" | "intercalary";
  month: number | null;
  name: string;
  days: number;
  season: Season;
  startDoy: number;
}

const segmentCache = new WeakMap<CalendarConfig, Segment[]>();

function segments(cal: CalendarConfig): Segment[] {
  const cached = segmentCache.get(cal);
  if (cached) return cached;
  const out: Segment[] = [];
  let doy = 0;
  cal.months.forEach((m, i) => {
    out.push({ kind: "month", month: i + 1, name: m.name, days: m.days, season: m.season, startDoy: doy });
    doy += m.days;
    for (const ic of cal.intercalary.filter((x) => x.afterMonth === i + 1)) {
      out.push({ kind: "intercalary", month: null, name: ic.name, days: 1, season: ic.season, startDoy: doy });
      doy += 1;
    }
  });
  segmentCache.set(cal, out);
  return out;
}

export function daysInYear(cal: CalendarConfig): number {
  return segments(cal).reduce((a, s) => a + s.days, 0);
}

export function validateCalendar(cal: CalendarConfig): string[] {
  const problems: string[] = [];
  if (cal.weekdayNames.length < 1) problems.push("calendar needs at least one weekday");
  if (cal.months.length < 1) problems.push("calendar needs at least one month");
  for (const f of cal.festivals) {
    if (f.month !== null) {
      const m = cal.months[f.month - 1];
      if (!m) problems.push(`festival ${f.id} references missing month ${f.month}`);
      else if (f.day < 1 || f.day + f.durationDays - 1 > m.days) problems.push(`festival ${f.id} falls outside month ${f.month}`);
    } else if (!cal.intercalary.some((ic) => ic.name === f.intercalary)) {
      problems.push(`festival ${f.id} references missing intercalary day ${f.intercalary}`);
    }
  }
  return problems;
}

function festivalsOn(cal: CalendarConfig, seg: Segment, dayOfMonth: number): FestivalConfig[] {
  return cal.festivals.filter((f) => {
    if (seg.kind === "intercalary") return f.month === null && f.intercalary === seg.name;
    return f.month === seg.month && dayOfMonth >= f.day && dayOfMonth < f.day + f.durationDays;
  });
}

export function dateFromDay(cal: CalendarConfig, absoluteDay: number): CalendarDate {
  const len = daysInYear(cal);
  const yearOffset = Math.floor(absoluteDay / len);
  const dayOfYear = absoluteDay - yearOffset * len;
  const segs = segments(cal);
  let seg = segs[0]!;
  for (const s of segs) {
    if (dayOfYear >= s.startDoy && dayOfYear < s.startDoy + s.days) {
      seg = s;
      break;
    }
  }
  const dayOfMonth = dayOfYear - seg.startDoy + 1;
  const n = cal.weekdayNames.length;
  const weekday = (((cal.epochWeekday + absoluteDay) % n) + n) % n;
  return {
    absoluteDay,
    year: cal.epochYear + yearOffset,
    dayOfYear,
    month: seg.month,
    monthName: seg.name,
    dayOfMonth,
    intercalary: seg.kind === "intercalary" ? seg.name : null,
    weekday,
    weekdayName: cal.weekdayNames[weekday]!,
    season: seg.season,
    isMarketDay: cal.marketDays.includes(weekday),
    isRestDay: cal.restDay === weekday,
    festivals: festivalsOn(cal, seg, dayOfMonth),
  };
}

/** Absolute day for a given year / 1-based month / 1-based day. */
export function dayFromDate(cal: CalendarConfig, year: number, month: number, dayOfMonth: number): number {
  const seg = segments(cal).find((s) => s.kind === "month" && s.month === month);
  if (!seg) throw new Error(`No month ${month} in calendar ${cal.id}`);
  if (dayOfMonth < 1 || dayOfMonth > seg.days) throw new Error(`Day ${dayOfMonth} is outside month ${month}`);
  return (year - cal.epochYear) * daysInYear(cal) + seg.startDoy + dayOfMonth - 1;
}

export function formatDate(d: CalendarDate, cal: CalendarConfig): string {
  if (d.intercalary) return `${d.intercalary}, ${d.year} ${cal.eraSuffix}`;
  return `${d.weekdayName}, ${d.dayOfMonth} ${d.monthName} ${d.year} ${cal.eraSuffix}`;
}

export function formatShortDate(d: CalendarDate): string {
  if (d.intercalary) return `${d.intercalary} ${d.year}`;
  return `${d.dayOfMonth} ${d.monthName} ${d.year}`;
}
