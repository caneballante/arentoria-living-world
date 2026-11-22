/**
 * PROPOSED campaign calendar: 13 months × 28 days + 1 intercalary festival day = 365.
 * Month names, weekday names, season boundaries and festivals are all proposals,
 * not campaign canon. The current in-world month and day are unresolved; the
 * simulation's default start date is a placeholder (see DEFAULT_START).
 */
import { dayFromDate, type CalendarConfig } from "../engine/calendar";
import { proposed } from "../engine/provenance";

const P = proposed("Calendar design proposal — not yet adopted by the DM.");

export const arentorCalendar: CalendarConfig = {
  id: "arentor-council-reckoning-proposal",
  label: "Council Reckoning (proposed)",
  provenance: P,
  eraSuffix: "CY",
  epochYear: 940,
  weekdayNames: ["Firstday", "Tradesday", "Hearthday", "Marketday", "Wardday", "Festday", "Restday"],
  epochWeekday: 0,
  months: [
    { name: "Deepfrost", days: 28, season: "winter" },
    { name: "Thawing", days: 28, season: "winter" },
    { name: "Seedtide", days: 28, season: "spring" },
    { name: "Rainmoot", days: 28, season: "spring" },
    { name: "Blossom", days: 28, season: "spring" },
    { name: "Highsun", days: 28, season: "summer" },
    { name: "Midsummer", days: 28, season: "summer" },
    { name: "Goldenreach", days: 28, season: "summer" },
    { name: "Harvest", days: 28, season: "autumn" },
    { name: "Leaffall", days: 28, season: "autumn" },
    { name: "Mistmoon", days: 28, season: "autumn" },
    { name: "Frostfall", days: 28, season: "winter" },
    { name: "Longnight", days: 28, season: "winter" },
  ],
  intercalary: [{ name: "Council Day", afterMonth: 13, season: "winter" }],
  marketDays: [3],
  restDay: 6,
  festivals: [
    {
      id: "seedtide-fair",
      name: "Seedtide Fair",
      provenance: P,
      month: 3,
      day: 7,
      durationDays: 1,
      demandMultiplier: { "grand-market": 1.4, commons: 1.2, "*": 1.1 },
      description: "Spring planting fair (proposed).",
    },
    {
      id: "midsummer-revel",
      name: "Midsummer Revel",
      provenance: P,
      month: 7,
      day: 14,
      durationDays: 2,
      demandMultiplier: { commons: 1.5, "*": 1.35 },
      description: "Two nights of street celebration (proposed).",
    },
    {
      id: "harvest-fair",
      name: "Harvest Fair",
      provenance: P,
      month: 9,
      day: 21,
      durationDays: 4,
      demandMultiplier: { "grand-market": 1.6, commons: 1.3, "high-march": 1.15, "*": 1.2 },
      description: "The city's largest market fair; farmers and buyers crowd the Grand Market (proposed).",
    },
    {
      id: "lantern-night",
      name: "Lantern Night",
      provenance: P,
      month: 10,
      day: 14,
      durationDays: 1,
      demandMultiplier: { commons: 1.45, "grand-market": 1.3, "*": 1.15 },
      description: "Evening lantern processions through the streets (proposed).",
    },
    {
      id: "longnight-vigil",
      name: "Longnight Vigil",
      provenance: P,
      month: 13,
      day: 28,
      durationDays: 1,
      demandMultiplier: { "*": 1.3 },
      description: "Midwinter vigil; hot food sells all night (proposed).",
    },
    {
      id: "council-day",
      name: "Council Day",
      provenance: P,
      month: null,
      day: 1,
      intercalary: "Council Day",
      durationDays: 1,
      demandMultiplier: { "grand-market": 1.5, "high-march": 1.3, "*": 1.25 },
      description: "Intercalary civic festival marking the new Council Year (proposed).",
    },
  ],
};

/**
 * PLACEHOLDER start date: 1 Harvest 940 CY (first day of autumn in the proposed
 * calendar). Canon says only "autumn of 940 CY"; the exact date is unresolved.
 */
export const DEFAULT_START = { year: 940, month: 9, day: 1 } as const;
export const DEFAULT_START_DAY = dayFromDate(arentorCalendar, DEFAULT_START.year, DEFAULT_START.month, DEFAULT_START.day);
