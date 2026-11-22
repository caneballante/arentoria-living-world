/**
 * Actors: canon factions and NPCs, plus PROPOSED small local actors (rivals, trade
 * groups, crews) whose conflicts can play out without involving the major factions.
 * Major faction objectives are intentionally left blank until campaign documents
 * describe them.
 */
import { canon, proposed } from "../engine/provenance";
import type { ActorDef } from "../engine/types";

const BRIEF = "Campaign brief";
const AWAITING = "Objectives and sphere of influence: awaiting campaign documents.";

export const actors: ActorDef[] = [
  // --- Canon major factions (names only; details pending) ---
  { id: "merchants-guild", name: "the Merchants' Guild", kind: "major-faction", provenance: canon(BRIEF), description: AWAITING },
  { id: "cloverpot-compact", name: "the Cloverpot Compact", kind: "major-faction", provenance: canon(BRIEF), description: AWAITING },
  { id: "stonehome-deep-ledger", name: "Stonehome / Deep Ledger", kind: "major-faction", provenance: canon(BRIEF), description: AWAITING },
  { id: "blanders-school", name: "the Blanders School of Adventuring", kind: "major-faction", provenance: canon(BRIEF), description: AWAITING },
  { id: "city-council", name: "the five-seat city Council", kind: "official-body", provenance: canon(BRIEF), description: AWAITING },
  { id: "galen-vale", name: "Galen Vale", kind: "npc", provenance: canon(BRIEF), description: "The party's lawyer; has initiated the constructs' licensing process." },

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
  {
    id: "ninepenny-crew",
    name: "the Ninepenny Crew",
    kind: "criminal-crew",
    provenance: proposed("Proposed small Commons protection racket — not one of the major factions."),
    description: "Half a dozen toughs who 'look after' Commons street sellers for a weekly fee.",
    neighborhoods: ["commons"],
  },
  {
    id: "saltgutter-crew",
    name: "the Saltgutter Crew",
    kind: "criminal-crew",
    provenance: proposed("Proposed Grand Market pickpocket-and-protection crew."),
    description: "Cutpurses and runners who work the market crowds and lean on stallholders.",
    neighborhoods: ["grand-market"],
  },
  {
    id: "velvet-gloves",
    name: "the Velvet Gloves",
    kind: "criminal-crew",
    provenance: proposed("Proposed discreet High March burglary ring."),
    description: "A quiet ring of burglars who prefer servants' gossip to street muscle.",
    neighborhoods: ["high-march"],
  },
  // --- Stand-ins for the newer districts (proposed; swap for City Index businesses or small factions if preferred) ---
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
  {
    id: "lowlamp-crew",
    name: "the Lowlamp Crew",
    kind: "criminal-crew",
    provenance: proposed("Proposed small Shades crew (stand-in), not one of the major factions."),
    description: "Hard young toughs who run the lanes below the ridge and take a cut from anyone selling there.",
    neighborhoods: ["shades"],
  },
  {
    id: "yard-gate-boys",
    name: "the Yard Gate Boys",
    kind: "criminal-crew",
    provenance: proposed("Proposed small Stoneback crew (stand-in)."),
    description: "Out-of-work laborers who 'keep order' at the yard gates and expect sellers to pay for the privilege.",
    neighborhoods: ["stoneback"],
  },
  {
    id: "cloister-dippers",
    name: "the Cloister Street Dippers",
    kind: "criminal-crew",
    provenance: proposed("Proposed small Scholarium pickpocket ring (stand-in)."),
    description: "Pickpockets who work the lecture crowds and occasionally lean on a stallholder.",
    neighborhoods: ["scholarium"],
  },
  {
    id: "gatehouse-gang",
    name: "the Gatehouse Gang",
    kind: "criminal-crew",
    provenance: proposed("Proposed small Outer Ward crew (stand-in)."),
    description: "A loose gang from the lodging houses by the old gate who shake down vendors on their rounds.",
    neighborhoods: ["outer-ward"],
  },
  {
    id: "seal-court-fixers",
    name: "the Seal Court Fixers",
    kind: "criminal-crew",
    provenance: proposed("Proposed small Crown Ward ring (stand-in)."),
    description: "Well-dressed go-betweens who sell 'introductions' and make permits move faster, or slower.",
    neighborhoods: ["crown-ward"],
  },
];
