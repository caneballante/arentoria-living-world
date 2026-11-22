/**
 * Weekly stock-and-flow dynamics for hidden state.
 *
 * Each hidden variable is a stock (0..100) with explicit inflows, outflows and decay.
 * Every update returns a list of named drivers whose values sum to the change, so the
 * DM view can always answer "why did this move?".
 */

import { hasActiveCondition } from "./economy";
import { clamp, clamp01, clamp100, mean } from "./math";
import type { BusinessPlan } from "./plan";
import type { DerivedMetrics, Driver, HiddenState, HiddenVar, StaffMember, WeekAccumulator, WorldDefinition, WorldState } from "./types";

export interface WeekStats {
  produced: number;
  sold: number;
  retailSold: number;
  cashSold: number;
  waste: number;
  operatingDays: number;
  stockoutDays: number;
  wholesaleDemand: number;
  wholesaleSold: number;
  wholesaleShortDays: number;
  advertisingCp: number;
  /** Mean utilization of selling capacity by role. */
  utilization: number;
}

export function weekStats(world: WorldDefinition, acc: WeekAccumulator): WeekStats {
  let produced = 0,
    sold = 0,
    retailSold = 0,
    cashSold = 0,
    waste = 0,
    operatingDays = 0,
    stockoutDays = 0,
    wholesaleDemand = 0,
    wholesaleSold = 0,
    wholesaleShortDays = 0;
  const utils: number[] = [];
  for (const d of acc.days) {
    produced += d.produced;
    sold += d.sold;
    waste += d.waste;
    if (d.operating) operatingDays++;
    if (d.channels.some((c) => c.stockout && c.channel !== "wholesale")) stockoutDays++;
    for (const c of d.channels) {
      if (c.channel === "wholesale") {
        wholesaleDemand += c.demand;
        wholesaleSold += c.sold;
        if (c.demand > 0 && c.sold < c.demand * 0.9) wholesaleShortDays++;
      } else retailSold += c.sold;
      if (world.channels[c.channel].handlesCash && c.channel !== "wholesale") cashSold += c.sold;
      if (c.capacity > 0) utils.push(Math.min(1, c.sold / c.capacity));
    }
  }
  return {
    produced,
    sold,
    retailSold,
    cashSold,
    waste,
    operatingDays,
    stockoutDays,
    wholesaleDemand,
    wholesaleSold,
    wholesaleShortDays,
    advertisingCp: acc.ledger.advertising,
    utilization: mean(utils),
  };
}

const sellingRoles = new Set(["vendor", "runner"]);

export function computeDerived(world: WorldDefinition, state: WorldState, weeklyFixedCostsCp: number): DerivedMetrics {
  const plan = state.plan;
  const staff = state.business.staff;
  const sellers = staff.filter((s) => sellingRoles.has(s.role));
  const staffCompetence = sellers.length ? mean(sellers.map((s) => s.competence)) : 0;
  const staffMorale = staff.length ? mean(staff.map((s) => s.morale)) : 0;
  const staffLoyalty = staff.length ? mean(staff.map((s) => s.loyalty)) : 0;
  const cash = state.business.cashCp;
  const runwayWeeks = weeklyFixedCostsCp > 0 ? Math.max(0, cash) / weeklyFixedCostsCp : 99;

  // Resilience emerges from the plan; it is not a player-controlled score.
  const supplierScore = [0, 0.6, 1][plan.suppliers - 1] ?? 1;
  const exposure = plan.channels.reduce((a, c) => a + c.share * world.channels[c.type].weatherExposure, 0);
  const diverse = plan.channels.filter((c) => c.share >= 0.2).length >= 2;
  const rolesNeeded = new Map<string, number>();
  for (const c of plan.channels) if (c.share > 0) rolesNeeded.set(world.channels[c.type].staffRole, (rolesNeeded.get(world.channels[c.type].staffRole) ?? 0) + 1);
  let redundant = 0;
  for (const [role, outlets] of rolesNeeded) if (staff.filter((s) => s.role === role).length > outlets) redundant++;
  const redundancyScore = rolesNeeded.size ? redundant / rolesNeeded.size : 0;
  const complianceScore = { informal: 0, basic: 0.5, full: 1 }[plan.compliance];
  const guards = staff.filter((s) => s.role === "guard").length;
  const resilienceBreakdown: Driver[] = [
    { label: "Supplier diversity", value: 20 * supplierScore },
    { label: "Weather-sheltered sales channels", value: 15 * (1 - exposure) + (diverse ? 5 : 0) },
    { label: "Cash runway", value: 20 * clamp01(runwayWeeks / 8) },
    { label: "Staff redundancy", value: 15 * redundancyScore },
    { label: "Legal compliance", value: 15 * complianceScore },
    { label: "Security", value: (plan.security.precautions ? 5 : 0) + Math.min(5, guards * 5) },
  ];
  const resilience = clamp100(resilienceBreakdown.reduce((a, d) => a + d.value, 0));

  const vulnerabilityBreakdown: Driver[] = [
    { label: "Thin cash runway", value: 50 * Math.max(0, 1 - runwayWeeks / 8) },
    { label: "Consecutive losing weeks", value: 8 * Math.min(4, state.business.consecutiveLossWeeks) },
    { label: "Owing the party money", value: cash < 0 ? 18 : 0 },
  ];
  const financialVulnerability = clamp100(vulnerabilityBreakdown.reduce((a, d) => a + d.value, 0));

  return {
    resilience,
    resilienceBreakdown,
    financialVulnerability,
    vulnerabilityBreakdown,
    staffCompetence,
    staffMorale,
    staffLoyalty,
    weeklyFixedCostsCp,
    runwayWeeks,
  };
}

export interface HiddenUpdate {
  next: HiddenState;
  drivers: Partial<Record<HiddenVar, Driver[]>>;
}

/** Weekly update of business-level hidden state. Pure. */
export function updateHidden(world: WorldDefinition, state: WorldState, stats: WeekStats, derived: DerivedMetrics, lastDay: number): HiddenUpdate {
  const plan = state.plan;
  const d = world.assumptions.dynamics;
  const n = world.neighborhoods[plan.neighborhood]!;
  const h = state.business.hidden;
  const drivers: Partial<Record<HiddenVar, Driver[]>> = {};
  const opDays = Math.max(1, stats.operatingDays);
  const stockoutShare = stats.stockoutDays / opDays;

  // --- Reputation: moves toward the experience customers actually have. ---
  {
    const k = d.reputation;
    const exposure = clamp01(stats.sold / k.minExposurePies);
    const r = k.adjustRate * exposure;
    const qTerm = clamp(k.qualityPerTier * (plan.quality - n.demand.qualityPreference), -25, 25);
    const fair = Math.max(1, n.demand.referencePriceCp * (1 + world.assumptions.demand.fairPriceQualitySlope * (plan.quality - n.demand.qualityPreference)));
    const valueTerm = clamp(k.valueWeight * (fair / plan.priceCp - 1), -k.valueCap, k.valueCap);
    const serviceTerm = stats.sold > 0 ? k.serviceWeight * (derived.staffCompetence - 50) : 0;
    const stockoutTerm = -k.stockoutPenalty * stockoutShare;
    const rushed = plan.constructWorkload === "pushed" && stats.operatingDays > 0 ? -d.constructs.pushedReputationPenalty : 0;
    const list: Driver[] = [
      { label: "Drift toward neutral", value: r * (50 - h.reputation) },
      { label: "Rushed baking (constructs pushed)", value: r * rushed },
      { label: "Quality vs. local expectations", value: r * qTerm },
      { label: "Value for money", value: r * valueTerm },
      { label: "Service (staff competence)", value: r * serviceTerm },
      { label: "Sold out / unreliable", value: r * stockoutTerm },
    ];
    drivers.reputation = list;
  }

  // --- Visibility: presence, advertising and word of mouth vs. fading memory. ---
  {
    const k = d.visibility;
    const sat = Math.max(0, 1 - h.visibility / k.saturation);
    const operated = stats.operatingDays > 0;
    const presence = operated ? plan.channels.filter((c) => c.share > 0).reduce((a, c) => a + world.channels[c.type].visibilityPerWeek, 0) * n.footfall : 0;
    const ads = k.advertisingWeight * Math.log(1 + stats.advertisingCp / k.advertisingScale);
    const wom = k.wordOfMouthPer1000 * (stats.sold / 1000) * (h.reputation / 50);
    const showcase = operated && plan.constructPublicity === "showcased" ? k.showcaseBonus : 0;
    drivers.visibility = [
      { label: "Outlets on the street", value: presence * sat },
      { label: "Advertising", value: ads * sat },
      { label: "Word of mouth", value: wom * sat },
      { label: "Magical chefs on show", value: showcase * sat },
      { label: "Fading public memory", value: -k.decay * h.visibility },
    ];
  }

  // --- Loyalty: regulars form when reputation is good and supply is reliable. ---
  {
    const k = d.loyalty;
    const exposure = clamp01(stats.sold / d.reputation.minExposurePies);
    const target = clamp100((h.reputation - 40) * 1.6) * (1 - 0.5 * stockoutShare);
    drivers.loyalty = [{ label: "Regulars responding to reputation and reliability", value: k.adjustRate * exposure * (target - h.loyalty) }];
  }

  // --- Official scrutiny ---
  {
    const k = d.scrutiny;
    const licensed = state.business.licensing.status === "approved";
    const operated = stats.operatingDays > 0;
    const list: Driver[] = [
      { label: `Compliance posture (${plan.compliance})`, value: operated ? k.noncompliance[plan.compliance] * n.enforcement * (h.visibility / 50) : 0 },
      {
        label: "Unlicensed constructs seen in public",
        // Magical constructs on public display draw official notice everywhere, more where enforcement is active.
        value: operated && !licensed && plan.constructPublicity === "showcased" ? k.showcaseUnlicensed * (0.5 + 0.5 * n.enforcement) : 0,
      },
      {
        label: "Entanglement with a criminal crew",
        value: plan.security.protectionPaymentCpPerWeek > 0 || hasActiveCondition(state, "paying-protection", lastDay) ? k.entanglement : 0,
      },
      { label: "Attention fading", value: -k.decay * h.scrutiny },
    ];
    drivers.scrutiny = list;
  }

  // --- Merchants' Guild relationship ---
  {
    const k = d.guild;
    const base = k.targets[plan.guild];
    const nonMember = plan.guild === "none" ? k.nonMemberVisibilityPenalty * n.guildPresence * (h.visibility / 100) : 0;
    const compliance = plan.compliance === "full" ? k.complianceBonus : 0;
    drivers.guildRelation = [
      { label: `Guild standing (${plan.guild})`, value: k.adjustRate * (base - h.guildRelation) },
      { label: "Visible non-member trading on guild turf", value: -k.adjustRate * nonMember },
      { label: "Full legal compliance", value: k.adjustRate * compliance },
    ];
  }

  // --- Criminal attention ---
  {
    const k = d.criminal;
    const exposure = k.base * n.crime * (h.visibility / 50) * Math.sqrt(stats.cashSold / 500);
    const guards = state.business.staff.filter((s) => s.role === "guard").length;
    const protection = plan.security.protectionPaymentCpPerWeek > 0 || hasActiveCondition(state, "paying-protection", lastDay);
    const mitigation = Math.min(
      k.maxMitigation,
      (plan.security.precautions ? k.precautionsMitigation : 0) + guards * k.guardMitigation + (protection ? k.protectionMitigation : 0),
    );
    drivers.criminalAttention = [
      { label: "Visible cash takings", value: exposure },
      { label: "Security arrangements", value: -exposure * mitigation },
      { label: "Crews losing interest", value: -k.decay * h.criminalAttention },
    ];
  }

  // --- Rival hostility ---
  {
    const k = d.rival;
    const marketSize = n.demand.baseDailyCustomers * opDays;
    const share = marketSize > 0 ? stats.retailSold / marketSize : 0;
    const damp = plan.guild === "member" ? 1 - k.memberDamping : plan.guild === "associate" ? 1 - k.memberDamping / 2 : 1;
    const undercut = Math.max(0, (n.demand.referencePriceCp - plan.priceCp) / n.demand.referencePriceCp);
    drivers.rivalHostility = [
      { label: "Customers taken from local sellers", value: k.shareWeight * n.competition * share * damp },
      { label: "Undercutting local prices", value: k.undercutWeight * n.competition * undercut * Math.min(1, share * 5) * damp },
      { label: "Grudges cooling", value: -k.decay * h.rivalHostility },
    ];
  }

  // --- Construct strain: builds while pushed, recovers with steady work and rest. ---
  {
    const k = d.constructs;
    const pushed = plan.constructWorkload === "pushed" && stats.operatingDays > 0;
    drivers.constructStrain = [
      { label: "Pushed past steady work", value: pushed ? k.strainPerPushedWeek * (stats.operatingDays / 7) : 0 },
      { label: "Rest and maintenance", value: -k.recoveryRate * h.constructStrain },
    ];
  }

  const next = { ...h };
  for (const key of Object.keys(drivers) as HiddenVar[]) {
    const delta = drivers[key]!.reduce((a, x) => a + x.value, 0);
    next[key] = clamp100(h[key] + delta);
  }
  return { next, drivers };
}

/** Weekly staff morale, loyalty and competence. Pure: returns updated staff list. */
export function updateStaff(world: WorldDefinition, plan: BusinessPlan, staff: StaffMember[], stats: WeekStats): StaffMember[] {
  const k = world.assumptions.dynamics.staff;
  const oversightMorale = { "hands-off": 0, weekly: 3, frequent: -2 }[plan.oversight];
  const oversightLearning = plan.oversight === "frequent" ? 0.5 : 0;
  return staff.map((s) => {
    const market = world.assumptions.marketWageCpPerDay[s.role];
    const wageTerm = clamp(k.wageSensitivity * (s.wageCpPerDay / market - 1), -35, 25);
    const overwork = sellingRoles.has(s.role) && stats.utilization > 0.95 ? k.overworkPenalty : 0;
    const target = clamp100(55 + wageTerm - overwork + oversightMorale);
    const morale = clamp100(s.morale + k.moraleAdjustRate * (target - s.morale));
    const loyalty = clamp100(s.loyalty + (morale > 60 ? 2 : morale < 35 ? -3 : 0.5));
    const competence = Math.min(s.traits.competenceCap, s.competence + k.learningPerWeek + oversightLearning);
    return { ...s, morale, loyalty, competence, lowMoraleWeeks: morale < k.quitMorale ? s.lowMoraleWeeks + 1 : 0 };
  });
}

/** Wholesale accounts grow toward a target set by reputation, quality and guild ties. */
export function updateWholesaleAccounts(world: WorldDefinition, state: WorldState, stats: WeekStats): { accounts: number; drivers: Driver[] } {
  const plan = state.plan;
  const share = plan.channels.filter((c) => c.type === "wholesale").reduce((a, c) => a + c.share, 0);
  const current = state.business.wholesaleAccounts;
  if (share <= 0) return { accounts: current, drivers: [] };
  const n = world.neighborhoods[plan.neighborhood]!;
  const w = world.assumptions.wholesale;
  const h = state.business.hidden;
  const repFactor = clamp01((h.reputation - 30) / 45);
  const qualityOk = plan.quality >= n.demand.qualityPreference - 1 ? 1 : 0.4;
  const guildFactor = { none: 0.75 + 0.25 * (h.guildRelation / 50), associate: 1.1, member: 1.25 }[plan.guild];
  const supplyLimit = (plan.weeklyProduction / plan.operatingDays) * share / w.piesPerAccountPerDay;
  const target = Math.min(n.wholesaleAccountPotential * repFactor * qualityOk * guildFactor, supplyLimit);
  const drivers: Driver[] = [];
  let next = current;
  if (stats.wholesaleShortDays >= 2) {
    next -= w.lossPerShortfallWeek;
    drivers.push({ label: "Missed deliveries", value: -w.lossPerShortfallWeek });
  } else if (target > current) {
    const gain = Math.min(w.maxNewAccountsPerWeek, (target - current) * 0.5);
    next += gain;
    drivers.push({ label: "New inns and taverns signing on", value: gain });
  } else if (target < current - 0.5) {
    const loss = Math.min(1, (current - target) * 0.3);
    next -= loss;
    drivers.push({ label: "Accounts drifting away", value: -loss });
  }
  return { accounts: Math.max(0, Math.round(next * 100) / 100), drivers };
}
