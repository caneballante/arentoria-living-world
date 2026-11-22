/**
 * Modelled neighborhoods. The neighborhood NAMES are canon; every number and
 * characterization below is PROVISIONAL and exists so the simulation can run.
 * Replace descriptions with campaign-document facts as they arrive.
 */
import { canon } from "../engine/provenance";
import type { ChannelDef, NeighborhoodDef } from "../engine/types";
import { provisional } from "../engine/provenance";

const nameIsCanon = (note: string) => canon("Campaign brief: established neighborhoods", `Name is canon; ${note}`);

export const neighborhoods: Record<string, NeighborhoodDef> = {
  commons: {
    id: "commons",
    name: "the Commons",
    provenance: nameIsCanon("characterization and numbers are provisional."),
    description:
      "Modelled as a crowded working district: lots of hungry passers-by, tight purses, many cheap food sellers and lax but present enforcement. (Provisional characterization.)",
    demand: {
      baseDailyCustomers: 600,
      referencePriceCp: 5,
      priceSensitivity: 2.0,
      qualityPreference: 2,
      qualityWeight: 0.22,
      qualityFloor: 1,
      qualityFloorPenalty: 1,
    },
    competition: 0.6,
    enforcement: 0.3,
    crime: 0.55,
    guildPresence: 0.35,
    footfall: 1.0,
    channelFit: { cart: 1.0, stall: 0.9, delivery: 0.3, wholesale: 1.0 },
    marketDayMultiplier: 1.1,
    restDayMultiplier: 0.95,
    permitFeeCpPerWeek: 50,
    stallFeeCpPerWeek: 60,
    marketTaxRate: 0.02,
    wholesaleAccountPotential: 8,
    rivalActorId: "hobbs-hot-pies",
    crewActorId: "ninepenny-crew",
  },
  "grand-market": {
    id: "grand-market",
    name: "the Grand Market",
    provenance: nameIsCanon("characterization and numbers are provisional."),
    description:
      "Modelled as the city's commercial heart: the largest crowds, busy market days, strong Merchants' Guild presence, active market enforcement and opportunistic thieves. (Provisional characterization.)",
    demand: {
      baseDailyCustomers: 950,
      referencePriceCp: 6,
      priceSensitivity: 1.6,
      qualityPreference: 3,
      qualityWeight: 0.35,
      qualityFloor: 2,
      qualityFloorPenalty: 0.6,
    },
    competition: 0.75,
    enforcement: 0.7,
    crime: 0.5,
    guildPresence: 0.9,
    footfall: 1.4,
    channelFit: { cart: 0.8, stall: 1.2, delivery: 0.5, wholesale: 1.2 },
    marketDayMultiplier: 1.35,
    restDayMultiplier: 0.75,
    permitFeeCpPerWeek: 100,
    stallFeeCpPerWeek: 200,
    marketTaxRate: 0.04,
    wholesaleAccountPotential: 12,
    rivalActorId: "brannock-pie-hall",
    crewActorId: "saltgutter-crew",
  },
  "high-march": {
    id: "high-march",
    name: "High March",
    provenance: nameIsCanon("characterization and numbers are provisional."),
    description:
      "Modelled as a wealthy district: few but discerning customers who pay well for quality and service, prefer delivery to street carts, and see little street crime. (Provisional characterization.)",
    demand: {
      baseDailyCustomers: 150,
      referencePriceCp: 16,
      priceSensitivity: 1.2,
      qualityPreference: 4,
      qualityWeight: 0.55,
      qualityFloor: 3,
      qualityFloorPenalty: 0.35,
    },
    competition: 0.4,
    enforcement: 0.6,
    crime: 0.18,
    guildPresence: 0.6,
    footfall: 0.8,
    channelFit: { cart: 0.45, stall: 0.8, delivery: 1.6, wholesale: 0.9 },
    marketDayMultiplier: 1.0,
    restDayMultiplier: 1.1,
    permitFeeCpPerWeek: 150,
    stallFeeCpPerWeek: 300,
    marketTaxRate: 0.03,
    wholesaleAccountPotential: 5,
    rivalActorId: "lattimer-daughters",
    crewActorId: "velvet-gloves",
  },
};

/** Canon neighborhoods not yet modelled economically. */
export const unmodelledNeighborhoods = ["Guildstrand", "Stoneback", "Scholarium", "Crown Ward", "the Shades", "Outer Ward"];

const C = provisional("Channel parameters are provisional.");

export const channels: Record<ChannelDef["type"], ChannelDef> = {
  cart: {
    type: "cart",
    label: "Street cart",
    provenance: C,
    staffRole: "vendor",
    trafficShare: 0.45,
    weatherExposure: 1.0,
    throughputPerStaff: 170,
    fixedCostCpPerWeek: 70,
    pricePremium: 1.0,
    visibilityPerWeek: 3,
    handlesCash: true,
    description: "Cheap and mobile, fully exposed to weather, a visible cash box on the street.",
  },
  stall: {
    type: "stall",
    label: "Market stall",
    provenance: C,
    staffRole: "vendor",
    trafficShare: 0.55,
    weatherExposure: 0.45,
    throughputPerStaff: 240,
    fixedCostCpPerWeek: 30,
    pricePremium: 1.0,
    visibilityPerWeek: 4.5,
    handlesCash: true,
    description: "Awning and counter in a fixed spot; pays a weekly stall fee; more visible.",
  },
  delivery: {
    type: "delivery",
    label: "Household delivery",
    provenance: C,
    staffRole: "runner",
    trafficShare: 0.4,
    weatherExposure: 0.6,
    throughputPerStaff: 70,
    fixedCostCpPerWeek: 25,
    pricePremium: 1.3,
    visibilityPerWeek: 1.2,
    handlesCash: true,
    description: "Runners carry baskets to households; customers pay a premium for convenience.",
  },
  wholesale: {
    type: "wholesale",
    label: "Wholesale to inns",
    provenance: C,
    staffRole: "runner",
    trafficShare: 0,
    weatherExposure: 0.1,
    throughputPerStaff: 300,
    fixedCostCpPerWeek: 40,
    pricePremium: 1.0,
    visibilityPerWeek: 1.5,
    handlesCash: false,
    description: "Steady standing orders from inns and taverns at a wholesale price; grows slowly with reputation.",
  },
};
