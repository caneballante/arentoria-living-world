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
];
