/**
 * Actors: canon factions and NPCs, plus PROPOSED small local actors (rivals, trade
 * groups, crews) whose conflicts can play out without involving the major factions.
 * Major faction objectives are intentionally left blank until campaign documents
 * describe them.
 */
import { canon, proposed } from "../engine/provenance";
import type { ActorDef } from "../engine/types";

const BRIEF = "Campaign brief";
const FACTIONS = "Factions of Arentoria (Revised), adopted by the DM 23 Nov 2026";
const FAITHS = "Faiths and Temples of Arentoria (Revised), adopted by the DM 23 Nov 2026";
const SC = (pool: string, status: string) =>
  proposed(`Small-time crew ${pool} from the DM's Factions document: name and optional district placement proposed for approval; ${status}.`);
/** Names only: what a crew does is decided in play; incidents stay minor and never escalate to a major faction on their own. */
const CREW = "Small-time operators. Names only: what they do is decided in play, and incidents stay minor.";

export const actors: ActorDef[] = [
  // --- Major established civic and economic groups (canon; spheres at high level only) ---
  { id: "merchants-guild", name: "the Merchants' Guild & Guild Wardens", kind: "major-faction", provenance: canon(FACTIONS, "City Index FAC-005."), description: "Guild commerce, permits and market standing." },
  { id: "cloverpot-compact", name: "the Cloverpot Compact", kind: "major-faction", provenance: canon(FACTIONS, "City Index FAC-002."), description: "A major criminal faction; not automatically behind every street crew." },
  { id: "deep-ledger", name: "the Deep Ledger", kind: "major-faction", provenance: canon(FACTIONS, "City Index FAC-004."), description: "A major criminal fraternity that keeps its own sphere." },
  { id: "stonehome-heritage-house", name: "Stonehome Heritage House", kind: "major-faction", provenance: canon(FACTIONS, "City Index FAC-003."), description: "Dwarven community and craft networks; separate from the Deep Ledger." },
  { id: "city-guard", name: "the City Guard and Watch", kind: "official-body", provenance: canon(FACTIONS, "City Index FAC-006."), description: "Public law enforcement." },
  { id: "blanders-school", name: "the Blanders School of Adventuring", kind: "major-faction", provenance: canon(FACTIONS, "City Index FAC-015."), description: "Training and adventuring contracts." },
  { id: "city-council", name: "the five-seat City Council", kind: "official-body", provenance: canon(FACTIONS), description: "Municipal authority." },
  { id: "harrowell-trust", name: "the Harrowell Agricultural Trust", kind: "major-faction", provenance: canon(FACTIONS, "City Index FAC-010."), description: "An agricultural institution." },
  { id: "galen-vale", name: "Galen Vale", kind: "npc", provenance: canon(BRIEF), description: "The party's lawyer; has initiated the constructs' licensing process." },

  // --- The seven public churches, as light factions. Standing is canon; district ties and
  //     institutional links are the documents' proposals, and describe patterns, not alliances. ---
  { id: "church-lathander", name: "the Church of Lathander", kind: "church", provenance: canon(FAITHS, "Standing canon; district and link proposed."), description: "Largest congregation. Sunrise worship, renewal, civic and household rites, charity. Observances: First Light, Longnight Vigil. Works with the City Council on ceremonies and charity.", neighborhoods: ["commons"] },
  { id: "church-waukeen", name: "the Church of Waukeen", kind: "church", provenance: canon(FAITHS, "Standing canon; district and link proposed."), description: "Wealthiest and best connected to the Council. Commerce, bargains, patronage. Observances: Golden Exchange, Ledger Closing. Close to the Merchants' Guild in trade and patronage.", neighborhoods: ["grand-market", "guildstrand"] },
  { id: "church-tyr", name: "the Church of Tyr", kind: "church", provenance: canon(FAITHS, "Standing canon; district and link proposed."), description: "Established, smaller. Justice, oaths, courts. Observance: Judgments and Oaths. Professional contact with the City Guard and Watch.", neighborhoods: ["crown-ward"] },
  { id: "church-sune", name: "the Church of Sune", kind: "church", provenance: canon(FAITHS, "Standing canon; district and link proposed."), description: "Established, smaller. Beauty, arts, performance. Observances: Festival of the Rose, Silken Promenade. Light patronage ties to luxury trade.", neighborhoods: ["high-march"] },
  { id: "church-chauntea", name: "the Church of Chauntea", kind: "church", provenance: canon(FAITHS, "Standing canon; district and link proposed."), description: "Established, smaller. Planting, harvest, food relief. Observances: Seedtide Fair, Harvest Fair. Shares agricultural work with the Harrowell Agricultural Trust.", neighborhoods: ["outer-ward", "commons"] },
  { id: "church-gond", name: "the Church of Gond", kind: "church", provenance: canon(FAITHS, "Standing canon; district and link proposed."), description: "Small specialist church. Invention, craft, engineering. Observances: Wonderwright's Day, First Hammer. Craft traditions shared with Stonehome Heritage House.", neighborhoods: ["stoneback"] },
  { id: "church-oghma", name: "the Church of Oghma", kind: "church", provenance: canon(FAITHS, "Standing canon; district and link proposed."), description: "Small specialist church. Learning, writing, remembered knowledge. Observance: The Open Book. Research ties with the Blanders School.", neighborhoods: ["scholarium"] },

  // --- Proposed small actors (provisional worldbuilding) ---
  {
    id: "bakers-fellowship",
    name: "the Bakers' and Piemakers' Fellowship",
    kind: "trade-group",
    provenance: proposed("Proposed trade fellowship affiliated with the Merchants' Guild; lets guild pressure stay local and small."),
    description: "A trade fellowship of bakers and pie-sellers that polices its members' turf and prices.",
  },
  {
    id: "licensing-office",
    name: "the city licensing office",
    kind: "official-body",
    provenance: proposed("Proposed municipal office for vendor permits and inspections."),
    description: "Clerks and inspectors who issue vendor permits, check food certificates and levy fines.",
  },
  {
    id: "hobbs-hot-pies",
    name: "Hobb's Hot Pies",
    kind: "rival-business",
    provenance: proposed("Proposed Commons rival."),
    description: "A long-established Commons pie shop run by a proud, territorial family.",
    neighborhoods: ["commons"],
  },
  {
    id: "brannock-pie-hall",
    name: "Brannock's Pie Hall",
    kind: "rival-business",
    provenance: proposed("Proposed Grand Market rival."),
    description: "A large market eatery with Fellowship connections and several stalls.",
    neighborhoods: ["grand-market"],
  },
  {
    id: "lattimer-daughters",
    name: "Lattimer & Daughters, Pastry Purveyors",
    kind: "rival-business",
    provenance: proposed("Proposed High March rival."),
    description: "A genteel pastry house that supplies several noble kitchens.",
    neighborhoods: ["high-march"],
  },
  // --- Rival pie sellers for the newer districts (proposed stand-ins) ---
  {
    id: "mother-gannets-cookshop",
    name: "Mother Gannet's Cookshop",
    kind: "rival-business",
    provenance: proposed("Proposed Shades rival (stand-in)."),
    description: "A cheap, steamy cookshop everyone in the Shades has eaten at since childhood. Hard to beat on trust.",
    neighborhoods: ["shades"],
  },
  {
    id: "old-brasks-dinner-pails",
    name: "Old Brask's Dinner Pails",
    kind: "rival-business",
    provenance: proposed("Proposed Stoneback rival (stand-in)."),
    description: "A handcart of stew and pasties that has fed the yard crews for twenty years, and knows every foreman.",
    neighborhoods: ["stoneback"],
  },
  {
    id: "inkpot-pasty-shop",
    name: "the Inkpot Pasty Shop",
    kind: "rival-business",
    provenance: proposed("Proposed Scholarium rival (stand-in)."),
    description: "A narrow shop by the lecture halls selling pasties on student credit.",
    neighborhoods: ["scholarium"],
  },
  {
    id: "widow-harls-hand-pies",
    name: "Widow Harl's Hand-Pies",
    kind: "rival-business",
    provenance: proposed("Proposed Outer Ward rival (stand-in)."),
    description: "A family of hand-pie sellers with delivery rounds on half the streets of the ward.",
    neighborhoods: ["outer-ward"],
  },
  {
    id: "gilded-crust-caterers",
    name: "the Gilded Crust Caterers",
    kind: "rival-business",
    provenance: proposed("Proposed Crown Ward rival (stand-in)."),
    description: "Society caterers with friends in the ministries and a jealous hold on official receptions.",
    neighborhoods: ["crown-ward"],
  },

  // --- The fifteen small-time criminal enterprises (the DM's pool, SC-01..SC-15). Each
  //     district's crew is drawn from its candidates once per campaign (see neighborhoods). ---
  { id: "ravenshade-lads", name: "the Ravenshade Lads", kind: "criminal-crew", provenance: SC("SC-01", "freelance, possible loose Compact contacts"), description: CREW, neighborhoods: ["commons"] },
  { id: "lucky-die-ring", name: "the Lucky Die Ring", kind: "criminal-crew", provenance: SC("SC-02", "independent"), description: CREW, neighborhoods: ["grand-market"] },
  { id: "ninepenny-crew", name: "the Ninepenny Crew", kind: "criminal-crew", provenance: SC("SC-03", "independent"), description: CREW, neighborhoods: ["commons"] },
  { id: "saltgutter-crew", name: "the Saltgutter Crew", kind: "criminal-crew", provenance: SC("SC-04", "independent"), description: CREW, neighborhoods: ["grand-market"] },
  { id: "velvet-gloves", name: "the Velvet Gloves", kind: "criminal-crew", provenance: SC("SC-05", "freelance"), description: CREW, neighborhoods: ["high-march"] },
  { id: "lowlamp-crew", name: "the Lowlamp Crew", kind: "criminal-crew", provenance: SC("SC-06", "independent"), description: CREW, neighborhoods: ["shades"] },
  { id: "yard-gate-boys", name: "the Yard Gate Boys", kind: "criminal-crew", provenance: SC("SC-07", "independent"), description: CREW, neighborhoods: ["stoneback"] },
  { id: "cloister-dippers", name: "the Cloister Street Dippers", kind: "criminal-crew", provenance: SC("SC-08", "independent"), description: CREW, neighborhoods: ["scholarium"] },
  { id: "gatehouse-gang", name: "the Gatehouse Gang", kind: "criminal-crew", provenance: SC("SC-09", "independent"), description: CREW, neighborhoods: ["outer-ward"] },
  { id: "seal-court-fixers", name: "the Seal Court Fixers", kind: "criminal-crew", provenance: SC("SC-10", "independent"), description: CREW, neighborhoods: ["crown-ward"] },
  { id: "bell-rope-boys", name: "the Bell-Rope Boys", kind: "criminal-crew", provenance: SC("SC-11", "freelance"), description: CREW, neighborhoods: ["guildstrand"] },
  { id: "copper-knaves", name: "the Copper Knaves", kind: "criminal-crew", provenance: SC("SC-12", "freelance"), description: CREW, neighborhoods: ["grand-market"] },
  { id: "ash-alley-cutters", name: "the Ash Alley Cutters", kind: "criminal-crew", provenance: SC("SC-13", "independent"), description: CREW, neighborhoods: ["stoneback"] },
  { id: "three-penny-syndicate", name: "the Three-Penny Syndicate", kind: "criminal-crew", provenance: SC("SC-14", "independent"), description: CREW, neighborhoods: ["commons", "guildstrand"] },
  { id: "moonstep-runners", name: "the Moonstep Runners", kind: "criminal-crew", provenance: SC("SC-15", "freelance"), description: CREW, neighborhoods: ["scholarium", "shades"] },
];
