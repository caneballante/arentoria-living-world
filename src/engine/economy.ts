/**
 * Economic model: demand, production, sales, costs.
 *
 * All numbers come from the WorldDefinition (assumptions, neighborhoods, channels).
 * The formulas are deliberately simple, monotone and explainable:
 *
 *   retail demand = potential customers
 *                 × channel reach × channel fit
 *                 × calendar (market day / rest day / festival)
 *                 × weather foot traffic × hot-food appeal (cold days help pies)
 *                 × price factor  exp(-sensitivity × (price/fair - 1))
 *                 × quality factor exp(weight × (quality - preferred))
 *                 × reputation × loyalty × awareness(visibility) × competition
 *                 × temporary modifiers × bounded noise
 *
 * The exponential price curve gives a well-defined profit-maximizing price near
 * cost + reference/sensitivity, so pricing has a real sweet spot per neighborhood.
 */

import type { CalendarDate } from "./calendar";
import { clamp, clamp01 } from "./math";
import type { BusinessPlan, ChannelType, StaffRole } from "./plan";
import { rngFor } from "./rng";
import type {
  ChannelDayResult,
  ChannelDef,
  Cp,
  DayRecord,
  LedgerCategory,
  ModifierTarget,
  NeighborhoodDef,
  StaffMember,
  WeekLedger,
  WorldDefinition,
  WorldState,
} from "./types";
import { fuelPriceIndex, ingredientPriceIndex } from "./weather";

export const emptyLedger = (): WeekLedger => ({
  revenue: 0,
  otherIncome: 0,
  ingredients: 0,
  fuel: 0,
  packaging: 0,
  wages: 0,
  rent: 0,
  permits: 0,
  stallFees: 0,
  guildDues: 0,
  protection: 0,
  advertising: 0,
  equipment: 0,
  taxes: 0,
  reserveHolding: 0,
  fines: 0,
  losses: 0,
  otherCosts: 0,
});

export const INCOME_CATEGORIES: LedgerCategory[] = ["revenue", "otherIncome"];

export function ledgerCosts(l: WeekLedger): Cp {
  return (Object.keys(l) as LedgerCategory[]).filter((k) => !INCOME_CATEGORIES.includes(k)).reduce((a, k) => a + l[k], 0);
}

export function ledgerIncome(l: WeekLedger): Cp {
  return l.revenue + l.otherIncome;
}

/** Product of active modifier multipliers for a target (optionally channel-specific). */
export function modifierProduct(state: WorldState, target: ModifierTarget, day: number, channel?: ChannelType): number {
  let m = 1;
  for (const mod of state.modifiers) {
    if (mod.target !== target || day < mod.fromDay || day > mod.untilDay) continue;
    if (mod.channel && mod.channel !== channel) continue;
    m *= mod.multiplier;
  }
  return m;
}

export function hasActiveCondition(state: WorldState, id: string, day: number): boolean {
  return state.conditions.some((c) => c.id === id && c.sinceDay <= day && (c.untilDay === undefined || c.untilDay >= day));
}

/** Weekdays the business operates: rest day is the first dropped. */
export function operatingWeekdays(world: WorldDefinition, plan: BusinessPlan): number[] {
  const n = world.calendar.weekdayNames.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
    const ra = a === world.calendar.restDay ? 1 : 0;
    const rb = b === world.calendar.restDay ? 1 : 0;
    return ra - rb || a - b;
  });
  return order.slice(0, Math.min(n, plan.operatingDays));
}

export function calendarMultiplier(n: NeighborhoodDef, date: CalendarDate): { value: number; festival: number } {
  let m = 1;
  if (date.isMarketDay) m *= n.marketDayMultiplier;
  if (date.isRestDay) m *= n.restDayMultiplier;
  let festival = 1;
  for (const f of date.festivals) festival = Math.max(festival, f.demandMultiplier[n.id] ?? f.demandMultiplier["*"] ?? 1);
  return { value: m * festival, festival };
}

/** District seasons (e.g. the Scholarium's summer recess); 1 where the district has none. */
export function seasonMultiplier(n: NeighborhoodDef, date: CalendarDate): number {
  return n.seasons?.multiplier[date.season] ?? 1;
}

export function qualityTierCost(world: WorldDefinition, quality: number): number {
  const tier = world.assumptions.qualityTiers.find((t) => t.tier === quality);
  if (!tier) throw new Error(`No quality tier ${quality}`);
  return tier.ingredientCostCp;
}

/** The price locals consider fair for this quality. */
export function fairPrice(world: WorldDefinition, n: NeighborhoodDef, quality: number): number {
  const slope = world.assumptions.demand.fairPriceQualitySlope;
  return Math.max(1, n.demand.referencePriceCp * (1 + slope * (quality - n.demand.qualityPreference)));
}

export function priceFactor(world: WorldDefinition, n: NeighborhoodDef, ch: ChannelDef, priceCp: number): number {
  const ref = n.demand.referencePriceCp * ch.pricePremium;
  return Math.min(world.assumptions.demand.priceFactorCap, Math.exp(-n.demand.priceSensitivity * (priceCp / ref - 1)));
}

export function qualityFactor(n: NeighborhoodDef, quality: number): number {
  const d = n.demand;
  const base = Math.exp(d.qualityWeight * (quality - d.qualityPreference));
  return quality < d.qualityFloor ? base * d.qualityFloorPenalty : base;
}

export function hotFoodFactor(world: WorldDefinition, tempC: number): number {
  const a = world.assumptions.demand;
  if (tempC < a.coldBoostThresholdC) return 1 + a.coldBoostPerDegree * (a.coldBoostThresholdC - tempC);
  if (tempC > a.heatThresholdC) return Math.max(0.7, 1 - a.heatPenaltyPerDegree * (tempC - a.heatThresholdC));
  return 1;
}

export interface RetailDemandResult {
  expected: number;
  factors: Record<string, number>;
}

/** Expected (pre-noise) retail demand for one outlet on one day. Pure. */
export function expectedRetailDemand(
  world: WorldDefinition,
  state: WorldState,
  plan: BusinessPlan,
  n: NeighborhoodDef,
  ch: ChannelDef,
  date: CalendarDate,
): RetailDemandResult {
  const a = world.assumptions.demand;
  const h = state.business.hidden;
  const weatherTraffic = 1 - ch.weatherExposure * (1 - world.climate.footTraffic[state.weather.condition]);
  const cal = calendarMultiplier(n, date);
  const competitionEff = clamp01(n.competition * modifierProduct(state, "competition", date.absoluteDay));
  const factors: Record<string, number> = {
    potential: n.demand.baseDailyCustomers * ch.trafficShare,
    channelFit: n.channelFit[ch.type],
    calendar: cal.value,
    season: seasonMultiplier(n, date),
    weather: weatherTraffic,
    hotFood: hotFoodFactor(world, state.weather.temperatureC),
    price: priceFactor(world, n, ch, plan.priceCp),
    quality: qualityFactor(n, plan.quality),
    reputation: a.reputationMin + (a.reputationMax - a.reputationMin) * (h.reputation / 100),
    loyalty: 1 + a.loyaltyBoostMax * (n.regularsWeight ?? 1) * (h.loyalty / 100),
    awareness: (n.awarenessFloor ?? a.awarenessFloor) + (1 - (n.awarenessFloor ?? a.awarenessFloor)) * (h.visibility / 100),
    competition: 1 - a.competitionImpact * competitionEff,
    novelty: plan.constructPublicity === "showcased" ? a.showcaseNovelty : 1,
    modifiers: modifierProduct(state, "demand", date.absoluteDay, ch.type),
  };
  const expected = Object.values(factors).reduce((x, y) => x * y, 1);
  return { expected, factors };
}

export function wholesaleDemand(world: WorldDefinition, state: WorldState, n: NeighborhoodDef, date: CalendarDate): number {
  const cal = calendarMultiplier(n, date);
  // Inns and taverns buy steadily; festivals lift orders modestly, weather barely matters.
  return Math.round(state.business.wholesaleAccounts * world.assumptions.wholesale.piesPerAccountPerDay * Math.sqrt(cal.festival) * seasonMultiplier(n, date));
}

export function wholesalePrice(world: WorldDefinition, n: NeighborhoodDef, plan: BusinessPlan): number {
  return Math.min(plan.priceCp, fairPrice(world, n, plan.quality)) * (n.wholesale?.priceFraction ?? world.assumptions.wholesale.priceFraction);
}

export function dailyConstructCapacity(world: WorldDefinition, plan: BusinessPlan): number {
  const c = world.assumptions.constructs;
  return c.count * c.piesPerDayEach * (plan.constructWorkload === "pushed" ? c.pushedCapacityMultiplier : 1);
}

/** How far into the red suppliers will let the business go before they stop delivering. */
export function supplierCreditLimitCp(world: WorldDefinition, plan: BusinessPlan, priceIndex = 1): number {
  return world.assumptions.account.supplierCreditWeeks * plan.weeklyProduction * qualityTierCost(world, plan.quality) * priceIndex;
}

export function productionCapacity(world: WorldDefinition, state: WorldState, day: number): number {
  return Math.floor(dailyConstructCapacity(world, state.plan) * modifierProduct(state, "productionCap", day));
}

export function unitIngredientCost(world: WorldDefinition, state: WorldState, plan: BusinessPlan, priceIndex: number, day: number): number {
  return (
    qualityTierCost(world, plan.quality) *
    priceIndex *
    (1 + world.assumptions.supplierPremiumPerExtra * (plan.suppliers - 1)) *
    modifierProduct(state, "ingredientCost", day)
  );
}

/** Assign present staff to outlets that need their role (round-robin by competence). */
export function assignStaff(
  world: WorldDefinition,
  plan: BusinessPlan,
  staff: StaffMember[],
  absent: Set<string>,
): Map<number, StaffMember[]> {
  const byChannel = new Map<number, StaffMember[]>();
  plan.channels.forEach((_, i) => byChannel.set(i, []));
  const roles = new Set<StaffRole>(plan.channels.map((c) => world.channels[c.type].staffRole));
  for (const role of roles) {
    const outlets = plan.channels.map((c, i) => ({ c, i })).filter(({ c }) => world.channels[c.type].staffRole === role && c.share > 0);
    if (!outlets.length) continue;
    const present = staff.filter((s) => s.role === role && !absent.has(s.id)).sort((a, b) => b.competence - a.competence || a.id.localeCompare(b.id));
    present.forEach((s, k) => byChannel.get(outlets[k % outlets.length]!.i)!.push(s));
  }
  return byChannel;
}

export interface DayOperationsResult {
  record: DayRecord;
  ledger: Partial<Record<LedgerCategory, number>>;
}

/**
 * Run one day of operations. Pure with respect to inputs: returns the day's record and
 * ledger entries; the caller applies them to state.
 */
export function runOperations(world: WorldDefinition, state: WorldState, date: CalendarDate): DayOperationsResult {
  const plan = state.plan;
  const n = world.neighborhoods[plan.neighborhood]!;
  const day = date.absoluteDay;
  const priceIndex = ingredientPriceIndex(world.market, world.calendar, state.market, date.dayOfYear);
  const baseRecord: DayRecord = {
    day,
    operating: false,
    produced: 0,
    sold: 0,
    waste: 0,
    channels: [],
    revenueTrueCp: 0,
    revenueReportedCp: 0,
    skimmedCp: 0,
    weather: state.weather,
    festivals: date.festivals.map((f) => f.name),
    absentStaff: [],
    shortage: false,
    priceIndex,
  };

  if (state.business.status === "closed") return { record: { ...baseRecord, reason: "closed" }, ledger: {} };
  if (state.business.status === "suspended") return { record: { ...baseRecord, reason: "suspended by authorities" }, ledger: {} };
  if (!operatingWeekdays(world, plan).includes(date.weekday)) return { record: { ...baseRecord, reason: "not an operating day" }, ledger: {} };

  const absent = new Set(state.business.staff.filter((s) => hasActiveCondition(state, `absent:${s.id}`, day)).map((s) => s.id));
  const festivalBoost = date.festivals.length ? plan.festivalProductionMultiplier : 1;
  const planned = (plan.weeklyProduction / plan.operatingDays) * festivalBoost;
  const capacity = productionCapacity(world, state, day);
  // An overdrawn account buys on credit at a premium; past the credit limit, suppliers stop delivering.
  const overdrawn = state.business.cashCp < 0;
  const cutOff = state.business.cashCp < -supplierCreditLimitCp(world, plan, priceIndex);
  const produced = cutOff ? 0 : Math.max(0, Math.floor(Math.min(planned, capacity)));
  const shortage = modifierProduct(state, "productionCap", day) < 1;

  const assignment = assignStaff(world, plan, state.business.staff, absent);
  const noise = world.assumptions.demand;
  const channels: ChannelDayResult[] = [];
  let skimmed = 0;
  let packaging = 0;
  let remainder = produced;

  plan.channels.forEach((c, i) => {
    const ch = world.channels[c.type];
    const allocated = i === plan.channels.length - 1 ? remainder : Math.min(remainder, Math.round(produced * c.share));
    remainder -= allocated;
    const team = assignment.get(i) ?? [];
    const capacityToday = Math.round(team.reduce((a, s) => a + ch.throughputPerStaff * (0.8 + 0.4 * (s.competence / 100)), 0));
    let demand: number;
    let priceCp: number;
    let factors: Record<string, number>;
    if (c.type === "wholesale") {
      demand = wholesaleDemand(world, state, n, date);
      priceCp = wholesalePrice(world, n, plan);
      factors = { accounts: state.business.wholesaleAccounts };
    } else {
      const r = expectedRetailDemand(world, state, plan, n, ch, date);
      const draw = rngFor(state.seed, "demand", day, i).normal(0, noise.noiseSd);
      const mult = clamp(Math.exp(draw), noise.noiseMin, noise.noiseMax);
      // A second outlet of the same kind in the same district mostly meets the same customers.
      const sameKindBefore = plan.channels.slice(0, i).filter((x) => x.type === c.type && x.share > 0).length;
      const reach = Math.pow(noise.extraOutletReach, sameKindBefore);
      demand = Math.round(r.expected * mult * reach);
      priceCp = plan.priceCp;
      factors = { ...r.factors, noise: mult, ...(reach < 1 ? { "extra outlet reach": reach } : {}) };
    }
    const sold = Math.max(0, Math.min(allocated, demand, capacityToday));
    const revenueCp = sold * priceCp;
    if (ch.handlesCash && c.type !== "wholesale") {
      // Skimming: dishonest, unhappy, unsupervised staff pocket part of the takings.
      for (const s of team) {
        const share = team.length ? revenueCp / team.length : 0;
        skimmed += share * skimRate(world, plan, s);
      }
    }
    if (c.type === "delivery") packaging += sold * world.assumptions.packagingCostPerDeliveredPieCp;
    channels.push({
      channel: c.type,
      allocated,
      demand,
      capacity: capacityToday,
      sold,
      priceCp,
      revenueCp,
      stockout: demand - sold >= Math.max(8, demand * 0.15),
      factors,
    });
  });

  const sold = channels.reduce((a, c) => a + c.sold, 0);
  const revenueTrue = channels.reduce((a, c) => a + c.revenueCp, 0);
  const skimmedCp = Math.round(skimmed);
  const revenueReported = Math.round(revenueTrue) - skimmedCp;
  const retailRevenue = channels.filter((c) => c.channel !== "wholesale").reduce((a, c) => a + c.revenueCp, 0);

  const wages = state.business.staff.filter((s) => !absent.has(s.id)).reduce((a, s) => a + s.wageCpPerDay, 0);
  const ingredients = produced * unitIngredientCost(world, state, plan, priceIndex, day) * (overdrawn ? world.assumptions.account.arrearsIngredientPremium : 1);
  const fuel = produced * world.assumptions.fuelCostPerPieCp * fuelPriceIndex(world.market, world.calendar, date.dayOfYear);
  const taxes = plan.compliance === "full" ? retailRevenue * n.marketTaxRate : 0;

  return {
    record: {
      ...baseRecord,
      operating: true,
      reason: cutOff ? "suppliers won't deliver until the bills are paid" : undefined,
      produced,
      sold,
      waste: produced - sold,
      channels,
      revenueTrueCp: Math.round(revenueTrue),
      revenueReportedCp: revenueReported,
      skimmedCp,
      absentStaff: [...absent],
      shortage,
    },
    ledger: {
      revenue: revenueReported,
      ingredients: Math.round(ingredients),
      fuel: Math.round(fuel),
      packaging: Math.round(packaging),
      wages,
      taxes: Math.round(taxes),
    },
  };
}

export function skimRate(world: WorldDefinition, plan: BusinessPlan, s: StaffMember): number {
  const k = world.assumptions.dynamics.skimming;
  if (s.traits.honesty >= k.honestyThreshold) return 0;
  const dishonesty = (k.honestyThreshold - s.traits.honesty) / k.honestyThreshold;
  const moraleFactor = s.morale < 40 ? 1.5 : s.morale > 70 ? 0.6 : 1;
  const loyaltyFactor = s.loyalty > 70 ? 0.5 : 1;
  return k.baseRate * dishonesty * k.oversight[plan.oversight] * moraleFactor * loyaltyFactor;
}

export interface FixedCostLine {
  category: LedgerCategory;
  amountCp: number;
  note: string;
}

/** Weekly fixed costs implied by the plan (and active conditions such as protection deals). */
export function weeklyFixedCosts(world: WorldDefinition, state: WorldState, avgDailyIngredientCp: number): FixedCostLine[] {
  const plan = state.plan;
  const a = world.assumptions;
  const n = world.neighborhoods[plan.neighborhood]!;
  const lines: FixedCostLine[] = [];
  const add = (category: LedgerCategory, amountCp: number, note: string) => {
    if (amountCp > 0) lines.push({ category, amountCp: Math.round(amountCp), note });
  };
  add("rent", a.kitchenRentShareCpPerWeek, "Kitchen share of 17 Dawnfire Promenade rent");
  add("equipment", a.constructs.upkeepCpPerWeek, "Construct upkeep");
  for (const c of plan.channels) {
    if (c.share <= 0) continue;
    const ch = world.channels[c.type];
    add("equipment", ch.fixedCostCpPerWeek, `${ch.label} upkeep/rental`);
    if (c.type === "stall") add("stallFees", n.stallFeeCpPerWeek, `${n.name} stall fee`);
  }
  if (plan.compliance !== "informal") add("permits", n.permitFeeCpPerWeek, `${n.name} vendor permit`);
  if (plan.compliance === "full") add("permits", a.foodCertificateCpPerWeek, "Food-safety certificate");
  if (plan.guild === "associate") add("guildDues", a.guild.associateDuesCpPerWeek, "Merchants' Guild associate dues");
  if (plan.guild === "member") add("guildDues", a.guild.memberDuesCpPerWeek, "Merchants' Guild member dues");
  if (plan.security.precautions) add("protection", a.precautionsCpPerWeek, "Security precautions (lockbox, escorts, varied routes)");
  add("protection", plan.security.protectionPaymentCpPerWeek, "Voluntary protection payment");
  const deal = state.conditions.find((c) => c.id === "paying-protection");
  if (deal && typeof deal.data?.feeCp === "number") add("protection", deal.data.feeCp, `Protection fee to ${String(deal.data.crew ?? "a local crew")}`);
  add("advertising", plan.advertisingCpPerWeek + state.business.reinvestAdvertisingCp, "Advertising and promotion");
  add("reserveHolding", plan.reserveDays * avgDailyIngredientCp * a.reserveHoldingRatePerWeek, `Holding ${plan.reserveDays} days of ingredient reserves`);
  return lines;
}
