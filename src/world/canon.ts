/**
 * Canon register: facts established in the campaign brief. Only facts recorded here
 * (or added later by the DM) are canon. Proposed worldbuilding lives alongside, but
 * is always labelled `proposed`. Simulation output is always `simulated`.
 */
import { canon } from "../engine/provenance";
import type { CanonFact } from "../engine/types";

const BRIEF = "Campaign brief (Arentoria Living World, initial)";

export const canonFacts: CanonFact[] = [
  { id: "setting-city", statement: "The campaign takes place in Arentoria, capital of Arentor.", provenance: canon(BRIEF), tags: ["setting"] },
  {
    id: "setting-time",
    statement: "The campaign's current date is 12 Rainmoot 940 CY, in spring (CY counts from the Charter of the Five Seats).",
    provenance: canon("DM ruling, 2026-11-23", "Supersedes the brief's \"autumn of 940 CY\" and the calendar document's open question."),
    tags: ["calendar"],
  },
  { id: "house-rent", statement: "The party rents a house at 17 Dawnfire Promenade in Guildstrand for 14 gp per week.", provenance: canon(BRIEF), tags: ["party", "economy"] },
  {
    id: "house-city-index",
    statement:
      "The party's house is City Index building AR-0603 (a Guildstrand row house at 17 Dawnfire Promenade). The households the City Index lists there (Tanner and Harrowell) do not live there in the campaign; the party does.",
    provenance: canon("DM ruling, 2026-11-22", "Overrides the City Index reference data for AR-0603."),
    tags: ["party", "geography", "city-index"],
  },
  { id: "constructs", statement: "The party possesses three magical chef constructs capable of preparing food.", provenance: canon(BRIEF), tags: ["party", "business"] },
  { id: "lawyer", statement: "Their lawyer, Galen Vale, has initiated the constructs' licensing process.", provenance: canon(BRIEF), tags: ["npc", "legal"] },
  { id: "license-filing", statement: "The construct licensing filing costs 15 gp and approval is expected in six months.", provenance: canon(BRIEF), tags: ["legal"] },
  { id: "home-cooking", statement: "The constructs may cook in the party's house while licensing is pending.", provenance: canon(BRIEF), tags: ["legal", "business"] },
  { id: "public-sales", statement: "Public sales require additional business arrangements and potentially other permissions.", provenance: canon(BRIEF), tags: ["legal", "business"] },
  { id: "hire-seller", statement: "The party has discussed hiring a local person to sell meat pies.", provenance: canon(BRIEF), tags: ["business"] },
  {
    id: "undecided",
    statement: "No business name, location, price, staffing arrangement or distribution plan has been finalized.",
    provenance: canon(BRIEF),
    tags: ["business"],
  },
  {
    id: "factions",
    statement: "Existing factions include the Merchants' Guild, the Cloverpot Compact, Stonehome/Deep Ledger, the Blanders School of Adventuring and the five-seat city Council. They have different objectives and spheres of influence.",
    provenance: canon(BRIEF),
    tags: ["factions"],
  },
  {
    id: "calendar",
    statement:
      "The Calendar of Arentor (Council Reckoning): 13 months of 28 days, then Council Day between years, outside the week. Weeks run Firstday, Tradesday, Hearthday, Marketday, Wardday, Festday, Restday. CY is counted from the Charter of the Five Seats. Public observances follow the calendar document.",
    provenance: canon("Arentoria Calendar (Revised), adopted by the DM 23 Nov 2026", "The current date is a separate DM ruling (setting-time)."),
    tags: ["calendar"],
  },
  {
    id: "public-churches",
    statement:
      "Arentoria has seven public churches. Lathander has the largest congregation; Waukeen the wealthiest and best-connected church. Tyr, Sune and Chauntea are established but smaller; Gond and Oghma are small specialist churches. These rankings describe the city, not the whole kingdom.",
    provenance: canon("Faiths and Temples of Arentoria (Revised), adopted by the DM 23 Nov 2026"),
    tags: ["religion"],
  },
  {
    id: "dawnfire-underground",
    statement: "Dawnfire worship is underground, with no openly celebrated holiday. Dawnfire is not the same as Lathander's church despite overlapping imagery.",
    provenance: canon("Faiths and Temples of Arentoria (Revised), adopted by the DM 23 Nov 2026"),
    tags: ["religion"],
  },
  {
    id: "major-factions",
    statement:
      "Major established groups: the Merchants' Guild & Guild Wardens, the Cloverpot Compact, the Deep Ledger, Stonehome Heritage House (separate from the Deep Ledger), the City Guard and Watch, the Blanders School of Adventuring, the five-seat City Council and the Harrowell Agricultural Trust.",
    provenance: canon("Factions of Arentoria (Revised), adopted by the DM 23 Nov 2026"),
    tags: ["factions"],
  },
  {
    id: "small-operators",
    statement:
      "Small-time criminal crews sit below the major factions. Their incidents stay minor (petty theft, market tricks, harassment, petty protection, counterfeit permits) and do not escalate to a major faction without an established link or an explicit DM decision.",
    provenance: canon("Factions of Arentoria (Revised), adopted by the DM 23 Nov 2026", "The fifteen crew names themselves are proposed for approval."),
    tags: ["factions", "crime"],
  },
  {
    id: "neighborhoods",
    statement: "Established neighborhoods: Guildstrand, Grand Market, the Commons, High March, Stoneback, Scholarium, Crown Ward, the Shades and Outer Ward.",
    provenance: canon(BRIEF),
    tags: ["geography"],
  },
];
