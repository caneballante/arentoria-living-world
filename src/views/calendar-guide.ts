/**
 * A season guide for players who don't know the calendar: every month in order,
 * grouped by season, with the current month marked and the months a stretch covers.
 */
import { dateFromDay, type Season } from "../engine/calendar";
import type { WorldDefinition } from "../engine/types";

export interface CalendarGuide {
  year: number;
  /** Months and days outside the months (Council Day), in year order. */
  slots: { kind: "month" | "intercalary"; number: number | null; name: string; season: Season; character: string; festivals: string[]; covered: boolean; current: boolean }[];
  current: { name: string; number: number | null; day: number; season: Season; character: string };
  next: { name: string; character: string } | null;
}

export function buildCalendarGuide(world: WorldDefinition, fromDay: number, toDay: number): CalendarGuide {
  const cal = world.calendar;
  const now = dateFromDay(cal, Math.max(fromDay, toDay));
  const covered = new Set<string>();
  for (let d = fromDay; d <= toDay && d - fromDay < 400; d++) covered.add(dateFromDay(cal, d).monthName);
  covered.add(now.monthName);
  const citywide = (month: number | null, ic?: string) =>
    cal.festivals.filter((f) => f.scale !== "district" && (month !== null ? f.month === month : f.month === null && f.intercalary === ic)).map((f) => f.name);
  const slots: CalendarGuide["slots"] = [];
  cal.months.forEach((m, i) => {
    slots.push({ kind: "month", number: i + 1, name: m.name, season: m.season, character: m.character ?? "", festivals: citywide(i + 1), covered: covered.has(m.name), current: now.monthName === m.name });
    for (const ic of cal.intercalary.filter((x) => x.afterMonth === i + 1)) {
      slots.push({ kind: "intercalary", number: null, name: ic.name, season: ic.season, character: "The day between years, outside the week", festivals: citywide(null, ic.name), covered: covered.has(ic.name), current: now.monthName === ic.name });
    }
  });
  const idx = slots.findIndex((s) => s.current);
  const nextSlot = slots[(idx + 1) % slots.length];
  return {
    year: now.year,
    slots,
    current: { name: now.monthName, number: now.month, day: now.dayOfMonth, season: now.season, character: slots[idx]?.character ?? "" },
    next: nextSlot ? { name: nextSlot.name, character: nextSlot.character } : null,
  };
}
