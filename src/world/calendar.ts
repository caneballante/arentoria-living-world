/**
 * The Calendar of Arentor (Council Reckoning). CANON: adopted by the DM on 23 Nov 2026
 * (the Arentoria Calendar, revised edition). 13 months of 28 days, then Council Day between
 * years (outside the week). Seven-day weeks: Firstday, Tradesday, Hearthday, Marketday,
 * Wardday, Festday, Restday. CY is counted from the Charter of the Five Seats.
 *
 * The festivals and observances are the document's. How much each one changes trade
 * (`demandMultiplier`) is PROVISIONAL and kept modest and mostly local, as the document
 * asks: a holiday is setting and commercial context, not a universal sales bonus.
 * Dawnfire has no openly celebrated holiday.
 *
 * Versioned by `id`: published campaign reports keep their dates; earlier calendars live
 * in git history so old simulations stay reproducible.
 */
import { dayFromDate, type CalendarConfig, type FestivalConfig } from "../engine/calendar";
import { canon } from "../engine/provenance";

const SOURCE = "Arentoria Calendar (Revised), adopted by the DM 23 Nov 2026";
const C = canon(SOURCE, "Dates and observances are canon; their effect on trade is provisional.");

const fest = (f: Omit<FestivalConfig, "provenance">): FestivalConfig => ({ provenance: C, ...f });

export const arentorCalendar: CalendarConfig = {
  id: "arentor-council-reckoning-2026-11",
  label: "Calendar of Arentor (Council Reckoning)",
  provenance: canon(SOURCE, "Structure, month names, weekdays and Council Day outside the week."),
  eraSuffix: "CY",
  epochYear: 940,
  weekdayNames: ["Firstday", "Tradesday", "Hearthday", "Marketday", "Wardday", "Festday", "Restday"],
  epochWeekday: 0,
  months: [
    { name: "Deepfrost", days: 28, season: "winter", character: "Deep cold; stores and indoor work" },
    { name: "Thawing", days: 28, season: "winter", character: "First thaw; variable roads" },
    { name: "Seedtide", days: 28, season: "spring", character: "Planting, seeds and rain" },
    { name: "Rainmoot", days: 28, season: "spring", character: "Wet roads; new planting" },
    { name: "Blossom", days: 28, season: "spring", character: "Flowers, weddings and arts" },
    { name: "Highsun", days: 28, season: "summer", character: "Longest daylight; trade routes open" },
    { name: "Midsummer", days: 28, season: "summer", character: "High public festival season" },
    { name: "Goldenreach", days: 28, season: "summer", character: "Late produce and trade fairs" },
    { name: "Harvest", days: 28, season: "autumn", character: "Reaping and great food markets" },
    { name: "Leaffall", days: 28, season: "autumn", character: "Cooling air and lantern processions" },
    { name: "Mistmoon", days: 28, season: "autumn", character: "Fog, markets and scholarship" },
    { name: "Frostfall", days: 28, season: "winter", character: "Winter preparations, charity" },
    { name: "Longnight", days: 28, season: "winter", character: "Deep darkness, vigils and hearths" },
  ],
  intercalary: [{ name: "Council Day", afterMonth: 13, season: "winter" }],
  intercalaryOutsideWeek: true,
  marketDays: [3],
  restDay: 6,
  festivals: [
    // --- Major citywide and seasonal observances (the six original IDs are kept) ---
    fest({ id: "first-light", name: "First Light", month: 3, day: 1, durationDays: 3, kind: "religious", scale: "citywide", sponsor: "Lathander", area: "Citywide, especially the Commons", demandMultiplier: { commons: 1.25, "*": 1.1 }, description: "Sunrise services, shared meals and renewal rites." }),
    fest({ id: "seedtide-fair", name: "Seedtide Fair", month: 3, day: 7, durationDays: 1, kind: "market", scale: "citywide", sponsor: "Chauntea and the growers", area: "Grand Market and Outer Ward", demandMultiplier: { "grand-market": 1.4, "outer-ward": 1.2, "*": 1.05 }, description: "A seasonal fair: seed and food exchange." }),
    fest({ id: "midsummer-revel", name: "Midsummer Revel", month: 7, day: 14, durationDays: 2, kind: "holiday", scale: "citywide", sponsor: "Civic, mixed faiths", area: "Commons and citywide", demandMultiplier: { commons: 1.5, "*": 1.3 }, description: "A large public revel: food, music and gathering." }),
    fest({ id: "golden-exchange", name: "Golden Exchange", month: 8, day: 14, durationDays: 3, kind: "market", scale: "citywide", sponsor: "Waukeen with the Merchants' Guild", area: "Grand Market and Guildstrand", demandMultiplier: { "grand-market": 1.4, "*": 0.95 }, description: "Contracts, auctions and visitors; the crowds go to the Grand Market." }),
    fest({ id: "harvest-fair", name: "Harvest Fair", month: 9, day: 21, durationDays: 4, kind: "market", scale: "citywide", sponsor: "Chauntea, growers and traders", area: "Grand Market and citywide", demandMultiplier: { "grand-market": 1.6, commons: 1.3, "high-march": 1.15, "*": 1.2 }, description: "The great agricultural and seasonal market." }),
    fest({ id: "lantern-night", name: "Lantern Night", month: 10, day: 14, durationDays: 1, kind: "evening", scale: "citywide", sponsor: "Neighborhood civic observance", area: "Commons and citywide", demandMultiplier: { commons: 1.45, "grand-market": 1.3, "*": 1.15 }, description: "Evening processions and street food." }),
    fest({ id: "longnight-vigil", name: "Longnight Vigil", month: 13, day: 28, durationDays: 1, kind: "religious", scale: "citywide", sponsor: "Lathander and civic households", area: "Citywide", demandMultiplier: { commons: 1.15, "*": 1.1 }, description: "Candlelight and vigils; ordinary shops may close, but vigil-goers want something hot." }),
    fest({ id: "council-day", name: "Council Day", month: null, intercalary: "Council Day", day: 1, durationDays: 1, kind: "holiday", scale: "citywide", sponsor: "The five-seat Council", area: "Crown Ward and Grand Market", demandMultiplier: { "grand-market": 1.5, "high-march": 1.3, "crown-ward": 1.6, "*": 1.25 }, description: "The day between years: proclamations and public gatherings." }),
    // --- District and smaller-church observances: local, modest ---
    fest({ id: "first-hammer", name: "First Hammer", month: 2, day: 10, durationDays: 1, kind: "market", scale: "district", sponsor: "Craft guilds and Gond", area: "Stoneback", demandMultiplier: { stoneback: 1.15 }, description: "Tool displays and first-year commissions." }),
    fest({ id: "open-furrow-blessing", name: "Open Furrow Blessing", month: 3, day: 21, durationDays: 1, kind: "religious", scale: "district", sponsor: "The Open Furrow community", area: "Outer Ward approaches", demandMultiplier: { "outer-ward": 1.1 }, description: "Seeds and communal meals (distinct from Chauntea)." }),
    fest({ id: "scribes-market", name: "Scribes' Market", month: 4, day: 17, durationDays: 1, kind: "market", scale: "district", sponsor: "Oghma and local scribes", area: "Scholarium", demandMultiplier: { scholarium: 1.15 }, description: "Manuscripts and writing supplies." }),
    fest({ id: "festival-of-the-rose", name: "Festival of the Rose", month: 5, day: 14, durationDays: 1, kind: "religious", scale: "district", sponsor: "Sune", area: "High March", demandMultiplier: { "high-march": 1.25 }, description: "Art, romance, flowers and performances." }),
    fest({ id: "silken-promenade", name: "Silken Promenade", month: 5, day: 20, durationDays: 1, kind: "holiday", scale: "district", sponsor: "Sune's patrons and artisans", area: "High March", demandMultiplier: { "high-march": 1.15 }, description: "Craft, dress and performance." }),
    fest({ id: "wonderwrights-day", name: "Wonderwright's Day", month: 6, day: 10, durationDays: 1, kind: "religious", scale: "district", sponsor: "Gond", area: "Stoneback", demandMultiplier: { stoneback: 1.2 }, description: "Mechanical exhibitions and artisan demonstrations." }),
    fest({ id: "cartwrights-circuit", name: "Cartwrights' Circuit", month: 8, day: 7, durationDays: 1, kind: "market", scale: "district", sponsor: "Artisans", area: "Stoneback and Grand Market", demandMultiplier: { stoneback: 1.15, "grand-market": 1.1 }, description: "A traveling trade display." }),
    fest({ id: "hearths-and-hands", name: "Hearths and Hands", month: 9, day: 6, durationDays: 1, kind: "holiday", scale: "district", sponsor: "Neighborhood associations", area: "Commons", demandMultiplier: { commons: 1.1 }, description: "Cooking and community tables." }),
    fest({ id: "duskmarket", name: "Duskmarket", month: 10, day: 20, durationDays: 1, kind: "evening", scale: "district", sponsor: "Local vendors", area: "the Shades", demandMultiplier: { shades: 1.25 }, description: "An evening small-trade fair." }),
    fest({ id: "the-open-book", name: "The Open Book", month: 11, day: 7, durationDays: 1, kind: "religious", scale: "district", sponsor: "Oghma", area: "Scholarium", demandMultiplier: { scholarium: 1.2 }, description: "Lectures, texts and public scholarship." }),
    fest({ id: "ledger-closing", name: "Ledger Closing", month: 11, day: 12, durationDays: 1, kind: "religious", scale: "district", sponsor: "Waukeen's merchant houses", area: "Guildstrand", demandMultiplier: {}, description: "Accounts and settling obligations." }),
    fest({ id: "judgments-and-oaths", name: "Judgments and Oaths", month: 12, day: 7, durationDays: 1, kind: "religious", scale: "district", sponsor: "Tyr", area: "Crown Ward", demandMultiplier: { "crown-ward": 1.15 }, description: "Public oaths and discussions of justice." }),
    fest({ id: "winter-stores-fair", name: "Winter Stores Fair", month: 12, day: 9, durationDays: 1, kind: "market", scale: "district", sponsor: "Market vendors", area: "Grand Market", demandMultiplier: { "grand-market": 1.2 }, description: "Fuel, preserved foods and winter provisioning." }),
  ],
};

/**
 * The campaign's date, set by the DM on 23 Nov 2026: 12 Rainmoot 940 CY (spring).
 * New campaigns start here; existing campaign files keep the start they were created with.
 */
export const DEFAULT_START = { year: 940, month: 4, day: 12 } as const;
export const DEFAULT_START_DAY = dayFromDate(arentorCalendar, DEFAULT_START.year, DEFAULT_START.month, DEFAULT_START.day);
