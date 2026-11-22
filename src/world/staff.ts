/**
 * PROPOSED hiring pool. These NPCs are drafts for play, not canon. Players see the
 * name, roles, blurb and asking wage; traits are hidden and revealed only through
 * play (reports, observation, freeform actions).
 */
import { proposed } from "../engine/provenance";
import type { StaffCandidate } from "../engine/types";

const P = proposed("Draft NPC for the hiring pool.");

export const staffPool: StaffCandidate[] = [
  {
    id: "pell-marrow",
    name: "Pell Marrow",
    provenance: P,
    roles: ["vendor"],
    blurb: "Commons-born, loud voice, seems to know everyone on the street.",
    askingWageCpPerDay: 20,
    traits: { competence: 55, honesty: 80, reliability: 70 },
  },
  {
    id: "wenna-thistle",
    name: "Wenna Thistle",
    provenance: P,
    roles: ["vendor"],
    blurb: "Sold roast chestnuts in the Grand Market for ten winters.",
    askingWageCpPerDay: 28,
    traits: { competence: 72, honesty: 65, reliability: 85 },
  },
  {
    id: "corbin-ashe",
    name: "Corbin Ashe",
    provenance: P,
    roles: ["vendor"],
    blurb: "Charming, cheap and available immediately.",
    askingWageCpPerDay: 14,
    traits: { competence: 50, honesty: 28, reliability: 60 },
  },
  {
    id: "ilsa-varn",
    name: "Ilsa Varn",
    provenance: P,
    roles: ["vendor", "runner"],
    blurb: "A former footman's daughter who knows which High March doors take deliveries.",
    askingWageCpPerDay: 25,
    traits: { competence: 66, honesty: 88, reliability: 78 },
  },
  {
    id: "dob-hennick",
    name: "Dob Hennick",
    provenance: P,
    roles: ["vendor", "runner"],
    blurb: "Fast on his feet, cheerful, easily distracted.",
    askingWageCpPerDay: 17,
    traits: { competence: 48, honesty: 72, reliability: 55 },
  },
  {
    id: "marta-quell",
    name: "Marta Quell",
    provenance: P,
    roles: ["vendor", "runner"],
    blurb: "Ran the front of a respected eating house until it closed last spring.",
    askingWageCpPerDay: 45,
    traits: { competence: 84, honesty: 76, reliability: 82 },
  },
  {
    id: "rook-tanner",
    name: "Rook Tanner",
    provenance: P,
    roles: ["runner"],
    blurb: "Knows every alley and shortcut in the city — perhaps a little too well.",
    askingWageCpPerDay: 16,
    traits: { competence: 58, honesty: 42, reliability: 72 },
  },
  {
    id: "tam-greaves",
    name: "Tam Greaves",
    provenance: P,
    roles: ["guard"],
    blurb: "Retired watch sergeant with a bad knee and a very good glare.",
    askingWageCpPerDay: 40,
    traits: { competence: 60, honesty: 85, reliability: 90 },
  },
];
