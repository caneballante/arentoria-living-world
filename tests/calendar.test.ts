import { describe, expect, it } from "vitest";
import { dateFromDay, dayFromDate, daysInYear, formatDate, validateCalendar } from "../src/engine/calendar";
import { arentorCalendar, DEFAULT_START_DAY } from "../src/world/calendar";

const cal = arentorCalendar;

describe("proposed campaign calendar", () => {
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

  it("runs a continuous seven-day week with market and rest days", () => {
    for (let day = 0; day < 400; day++) expect(dateFromDay(cal, day + 1).weekday).toBe((dateFromDay(cal, day).weekday + 1) % 7);
    const marketDays = Array.from({ length: 28 }, (_, i) => dateFromDay(cal, i)).filter((d) => d.isMarketDay);
    expect(marketDays).toHaveLength(4);
  });

  it("assigns seasons and festivals", () => {
    const start = dateFromDay(cal, DEFAULT_START_DAY);
    expect(start.season).toBe("autumn");
    expect(start.monthName).toBe("Harvest");
    expect(start.year).toBe(940);
    expect(dateFromDay(cal, dayFromDate(cal, 940, 1, 10)).season).toBe("winter");
    expect(dateFromDay(cal, dayFromDate(cal, 940, 7, 10)).season).toBe("summer");
    const fair = dateFromDay(cal, dayFromDate(cal, 940, 9, 22));
    expect(fair.festivals.map((f) => f.id)).toEqual(["harvest-fair"]);
    expect(formatDate(start, cal)).toMatch(/1 Harvest 940 CY/);
  });

  it("is labelled as a proposal, not canon", () => {
    expect(cal.provenance.status).toBe("proposed");
    expect(cal.festivals.every((f) => f.provenance.status === "proposed")).toBe(true);
  });
});
