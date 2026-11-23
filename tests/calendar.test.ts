import { describe, expect, it } from "vitest";
import { dateFromDay, dayFromDate, daysInYear, formatDate, validateCalendar } from "../src/engine/calendar";
import { arentorCalendar, DEFAULT_START_DAY } from "../src/world/calendar";

const cal = arentorCalendar;

describe("the Calendar of Arentor (canon)", () => {
  it("has 13 months of 28 days plus one intercalary day (365)", () => {
    expect(cal.months).toHaveLength(13);
    expect(cal.months.every((m) => m.days === 28)).toBe(true);
    expect(daysInYear(cal)).toBe(365);
    expect(validateCalendar(cal)).toEqual([]);
  });

  it("round-trips dates and handles the intercalary festival day", () => {
    for (let day = 0; day < 365 * 3; day += 17) {
      const d = dateFromDay(cal, day);
      if (d.month !== null) expect(dayFromDate(cal, d.year, d.month, d.dayOfMonth)).toBe(day);
    }
    const councilDay = dateFromDay(cal, 364);
    expect(councilDay.intercalary).toBe("Council Day");
    expect(councilDay.month).toBeNull();
    expect(councilDay.festivals.map((f) => f.id)).toContain("council-day");
    const nextYear = dateFromDay(cal, 365);
    expect(nextYear.year).toBe(941);
    expect(nextYear.month).toBe(1);
    expect(nextYear.dayOfMonth).toBe(1);
  });

  it("runs a seven-day week, with Council Day outside the week", () => {
    let prev = dateFromDay(cal, 0).weekday;
    for (let day = 1; day < 800; day++) {
      const d = dateFromDay(cal, day);
      if (d.intercalary) {
        expect(d.weekday).toBe(-1);
        expect(d.isMarketDay || d.isRestDay).toBe(false);
        continue; // the week resumes after Council Day
      }
      expect(d.weekday).toBe((prev + 1) % 7);
      prev = d.weekday;
    }
    expect(cal.weekdayNames).toEqual(["Firstday", "Tradesday", "Hearthday", "Marketday", "Wardday", "Festday", "Restday"]);
    const marketDays = Array.from({ length: 28 }, (_, i) => dateFromDay(cal, i)).filter((d) => d.isMarketDay);
    expect(marketDays).toHaveLength(4);
    expect(marketDays.every((d) => d.weekdayName === "Marketday")).toBe(true);
  });

  it("assigns seasons and festivals", () => {
    const start = dateFromDay(cal, DEFAULT_START_DAY);
    // The DM's date (23 Nov 2026): 12 Rainmoot 940 CY, in spring.
    expect(start.season).toBe("spring");
    expect(start.monthName).toBe("Rainmoot");
    expect(start.dayOfMonth).toBe(12);
    expect(start.year).toBe(940);
    expect(dateFromDay(cal, dayFromDate(cal, 940, 1, 10)).season).toBe("winter");
    expect(dateFromDay(cal, dayFromDate(cal, 940, 7, 10)).season).toBe("summer");
    const fair = dateFromDay(cal, dayFromDate(cal, 940, 9, 22));
    expect(fair.festivals.map((f) => f.id)).toEqual(["harvest-fair"]);
    expect(formatDate(start, cal)).toMatch(/12 Rainmoot 940 CY/);
  });

  it("is canon, adopted by the DM, with the effect on trade marked provisional", () => {
    expect(cal.provenance.status).toBe("canon");
    expect(cal.festivals.every((f) => f.provenance.status === "canon" && /provisional/.test(f.provenance.note ?? ""))).toBe(true);
  });

  it("keeps the six original festival ids and adds the calendar's other observances", () => {
    const ids = cal.festivals.map((f) => f.id);
    for (const id of ["seedtide-fair", "midsummer-revel", "harvest-fair", "lantern-night", "longnight-vigil", "council-day", "first-light", "golden-exchange", "duskmarket", "the-open-book"]) expect(ids).toContain(id);
    expect(cal.festivals.filter((f) => f.scale === "citywide")).toHaveLength(8);
    expect(cal.festivals.filter((f) => f.scale === "district")).toHaveLength(13);
    // District observances only touch their own district (modest, local).
    for (const f of cal.festivals.filter((x) => x.scale === "district")) expect(f.demandMultiplier["*"]).toBeUndefined();
  });
});
