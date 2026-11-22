/**
 * PROVISIONAL economic and behavioral assumptions. Every number here is a modelling
 * guess meant to be calibrated at the table. Currency: 1 gp = 10 sp = 100 cp.
 *
 * Anchors used for the guesses:
 *  - Canon: house rent 14 gp/week; three constructs; licensing filing 15 gp; approval ~6 months.
 *  - D&D convention: unskilled hireling ~2 sp/day; modest meals a few sp; bread a few cp.
 *
 * See docs/ASSUMPTIONS.md for the calibration checklist.
 */
import { provisional } from "../engine/provenance";
import type { EconomicAssumptions } from "../engine/types";

export const assumptions: EconomicAssumptions = {
  provenance: provisional("Initial calibration guesses (v0.1)."),
  constructs: { count: 3, piesPerDayEach: 70, upkeepCpPerWeek: 0 },
  qualityTiers: [
    { tier: 1, label: "Scrap & gristle", ingredientCostCp: 1.0 },
    { tier: 2, label: "Plain & honest", ingredientCostCp: 1.8 },
    { tier: 3, label: "Good", ingredientCostCp: 3.0 },
    { tier: 4, label: "Fine", ingredientCostCp: 5.5 },
    { tier: 5, label: "Exquisite", ingredientCostCp: 10 },
  ],
  fuelCostPerPieCp: 0.3,
  packagingCostPerDeliveredPieCp: 0.3,
  // Canon rent is 14 gp/week; assume the business is charged a quarter of it for kitchen use.
  kitchenRentShareCpPerWeek: 350,
  marketWageCpPerDay: { vendor: 20, runner: 18, guard: 40 },
  guild: { associateDuesCpPerWeek: 100, memberDuesCpPerWeek: 250, memberInitiationCp: 1000, associateInitiationCp: 200 },
  foodCertificateCpPerWeek: 40,
  precautionsCpPerWeek: 30,
  supplierPremiumPerExtra: 0.03,
  reserveHoldingRatePerWeek: 0.08,
  demand: {
    awarenessFloor: 0.2,
    reputationMin: 0.55,
    reputationMax: 1.45,
    loyaltyBoostMax: 0.35,
    competitionImpact: 0.45,
    noiseSd: 0.12,
    noiseMin: 0.7,
    noiseMax: 1.4,
    priceFactorCap: 3,
    coldBoostThresholdC: 14,
    coldBoostPerDegree: 0.012,
    heatThresholdC: 24,
    heatPenaltyPerDegree: 0.01,
    showcaseNovelty: 1.12,
    fairPriceQualitySlope: 0.3,
  },
  wholesale: { piesPerAccountPerDay: 30, priceFraction: 0.8, maxNewAccountsPerWeek: 1, lossPerShortfallWeek: 1, initialAccounts: 1 },
  initialHidden: { reputation: 50, loyalty: 0, visibility: 5, scrutiny: 5, guildRelation: 45, criminalAttention: 5, rivalHostility: 5 },
  // Canon: approval expected six months after filing. Assumes filing happened ~2 weeks before the
  // simulation start (unresolved), so the ruling lands at the start of week 25.
  licensingDecisionAfterDays: 168,
  dynamics: {
    reputation: { adjustRate: 0.2, qualityPerTier: 10, valueWeight: 25, valueCap: 15, serviceWeight: 0.25, stockoutPenalty: 6, minExposurePies: 300 },
    visibility: { decay: 0.1, saturation: 110, advertisingScale: 100, advertisingWeight: 5, wordOfMouthPer1000: 2.5, showcaseBonus: 6, start: 5 },
    loyalty: { adjustRate: 0.08 },
    scrutiny: { decay: 0.12, noncompliance: { informal: 5, basic: 2, full: 0.5 }, showcaseUnlicensed: 8, entanglement: 1.5 },
    guild: { adjustRate: 0.15, targets: { none: 45, associate: 62, member: 75 }, nonMemberVisibilityPenalty: 40, complianceBonus: 5 },
    criminal: { decay: 0.1, base: 5, precautionsMitigation: 0.25, guardMitigation: 0.3, protectionMitigation: 0.75, maxMitigation: 0.85 },
    rival: { decay: 0.1, shareWeight: 20, undercutWeight: 25, memberDamping: 0.4 },
    staff: { moraleAdjustRate: 0.3, wageSensitivity: 60, overworkPenalty: 10, learningPerWeek: 1.2, competenceHeadroom: 15, quitMorale: 22, quitAfterWeeks: 2 },
    skimming: { honestyThreshold: 50, baseRate: 0.25, oversight: { "hands-off": 1, weekly: 0.45, frequent: 0.15 } },
    absence: { base: 0.01, unreliability: 0.05, lowMorale: 0.03 },
  },
};
