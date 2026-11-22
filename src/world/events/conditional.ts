/**
 * Conditional and opportunity events. Each has a hazard (probability with named
 * drivers, computed from actual world conditions) and a resolution (structured
 * effects + what players perceive + what is really happening).
 *
 * All events are PROPOSED content. Probabilities are PROVISIONAL.
 */
import { fairPrice, hasActiveCondition, productionCapacity, unitIngredientCost } from "../../engine/economy";
import { clamp01 } from "../../engine/math";
import { proposed } from "../../engine/provenance";
import type { ConditionalEventDef, Driver, Effect } from "../../engine/types";
import { ingredientPriceIndex } from "../../engine/weather";
import { formatCp, isOperatingDay, securityMitigation, vendors } from "./helpers";

const P = proposed("Event content is proposed; probabilities are provisional.");

const staffAbsence: ConditionalEventDef = {
  id: "staff-absence",
  title: "Staff absence",
  category: "conditional",
  provenance: P,
  phase: "morning",
  cooldownDays: 0,
  pacing: "flavor",
  hazard(ctx) {
    if (!isOperatingDay(ctx)) return { probability: 0, drivers: [] };
    const k = ctx.world.assumptions.dynamics.absence;
    const drivers: Driver[] = ctx.state.business.staff.map((s) => ({
      label: `${s.name} (reliability, morale)`,
      value: k.base + k.unreliability * ((100 - s.traits.reliability) / 100) + (s.morale < 40 ? k.lowMorale : 0),
    }));
    const p = 1 - drivers.reduce((a, d) => a * (1 - d.value), 1);
    return { probability: p, drivers };
  },
  resolve(ctx, rng) {
    const k = ctx.world.assumptions.dynamics.absence;
    const staff = ctx.state.business.staff;
    const weights = staff.map((s) => k.base + k.unreliability * ((100 - s.traits.reliability) / 100) + (s.morale < 40 ? k.lowMorale : 0));
    const who = staff[rng.weightedIndex(weights)]!;
    const covered = staff.some((s) => s.id !== who.id && s.role === who.role);
    return {
      severity: "minor",
      playerText: `${who.name} didn't turn up today${covered ? "; the others covered as best they could." : ", and nobody could cover."}`,
      dmText: `${who.name} absent (reliability ${who.traits.reliability}, morale ${Math.round(who.morale)}). ${covered ? "Redundant staff covered." : "No redundancy: their outlet loses the day."}`,
      effects: [{ kind: "addCondition", id: `absent:${who.id}`, label: `${who.name} absent`, durationDays: 1, visibleToPlayers: true }],
    };
  },
};

const supplyShortage: ConditionalEventDef = {
  id: "supply-shortage",
  title: "Supply shortage",
  category: "conditional",
  provenance: P,
  phase: "morning",
  cooldownDays: 5,
  pacing: "adverse",
  hazard(ctx) {
    if (!isOperatingDay(ctx)) return { probability: 0, drivers: [] };
    const disruption = ctx.world.climate.transportDisruption[ctx.state.weather.condition];
    const supplierFactor = [1, 0.45, 0.25][ctx.plan.suppliers - 1] ?? 0.25;
    const obstruction = ctx.hasCondition("guild-obstruction") ? 2.5 : 1;
    const base = ctx.plan.quality >= 4 ? 0.018 : 0.012;
    const drivers: Driver[] = [
      { label: ctx.plan.quality >= 4 ? "Baseline (fine ingredients are harder to source)" : "Baseline chance of a missed delivery", value: base },
      { label: `Roads and carts in ${ctx.state.weather.condition} weather`, value: base * 3 * disruption },
      { label: `${ctx.plan.suppliers} supplier(s)`, value: (base * (1 + 3 * disruption)) * (supplierFactor - 1) },
    ];
    if (obstruction > 1) drivers.push({ label: "Suppliers cold-shouldering us (guild pressure)", value: base * (1 + 3 * disruption) * supplierFactor * (obstruction - 1) });
    return { probability: base * (1 + 3 * disruption) * supplierFactor * obstruction, drivers };
  },
  resolve(ctx, rng) {
    const duration = rng.int(1, 3);
    const reserve = ctx.plan.reserveDays;
    const premium: Effect = { kind: "modifier", id: "shortage-premium", label: "Emergency ingredient purchases", target: "ingredientCost", multiplier: 1.2, durationDays: duration };
    if (reserve >= duration) {
      return {
        severity: "minor",
        playerText: `Our supplier couldn't deliver for ${duration} day(s); we drew on our reserves and restocked at a premium.`,
        dmText: `Shortage of ${duration} day(s) fully covered by ${reserve} reserve day(s).`,
        effects: [premium],
      };
    }
    const short = duration - reserve;
    return {
      severity: "notable",
      playerText: `Deliveries failed for ${duration} day(s). With ${reserve ? "only " + reserve + " day(s) of" : "no"} reserves, the constructs had ingredients for about a third of the usual batch.`,
      dmText: `Shortage of ${duration} day(s); reserves covered ${reserve}. Production capped at 35% for ${short} day(s).`,
      effects: [premium, { kind: "modifier", id: "shortage-cap", label: "Ingredient shortage", target: "productionCap", multiplier: 0.35, durationDays: short }],
    };
  },
};

const unexpectedCrowd: ConditionalEventDef = {
  id: "unexpected-crowd",
  title: "Unexpected crowd",
  category: "opportunity",
  provenance: P,
  phase: "morning",
  cooldownDays: 10,
  pacing: "flavor",
  hazard(ctx) {
    if (!isOperatingDay(ctx)) return { probability: 0, drivers: [] };
    return { probability: 0.025, drivers: [{ label: "Ordinary city life", value: 0.025 }] };
  },
  resolve(_ctx, rng) {
    const reason = rng.pick([
      "a travelling puppet show drew a crowd",
      "a wedding party spilled into the street",
      "a rumor of a famous bard's visit packed the square",
      "a public proclamation brought half the street out",
    ]);
    return {
      severity: "minor",
      playerText: `Unexpectedly busy: ${reason}. Anyone with pies to sell did well.`,
      dmText: `Demand ×1.6 today (${reason}). Businesses with spare stock benefit; others sell out.`,
      effects: [{ kind: "modifier", id: "crowd", label: "Unexpected crowd", target: "demand", multiplier: 1.6, durationDays: 1 }],
    };
  },
};

const pettyTheft: ConditionalEventDef = {
  id: "petty-theft",
  title: "Petty theft",
  category: "conditional",
  provenance: P,
  phase: "evening",
  cooldownDays: 4,
  pacing: "adverse",
  hazard(ctx) {
    const today = ctx.today;
    if (!today?.operating) return { probability: 0, drivers: [] };
    const cashRevenue = today.channels.filter((c) => ctx.world.channels[c.channel].handlesCash && c.channel !== "wholesale").reduce((a, c) => a + c.revenueCp, 0);
    if (cashRevenue <= 0) return { probability: 0, drivers: [] };
    const base = 0.035 * ctx.neighborhood.crime * (ctx.state.business.hidden.criminalAttention / 40);
    const sec = securityMitigation(ctx);
    return {
      probability: base * (1 - sec.value),
      drivers: [
        { label: `Street crime in ${ctx.neighborhood.name}`, value: 0.035 * ctx.neighborhood.crime },
        { label: "Criminal attention on the business", value: base - 0.035 * ctx.neighborhood.crime },
        ...sec.drivers.map((d) => ({ ...d, value: d.value * base })),
      ],
    };
  },
  resolve(ctx, rng) {
    const today = ctx.today!;
    const cashRevenue = today.channels.filter((c) => c.channel !== "wholesale").reduce((a, c) => a + c.revenueCp, 0);
    const loss = Math.max(5, Math.round(cashRevenue * rng.range(0.3, 0.7)));
    const effects: Effect[] = [
      { kind: "cash", amountCp: -loss, category: "losses", note: "Stolen takings" },
      { kind: "adjust", variable: "criminalAttention", delta: 2 },
      ...vendors(ctx).map((s) => ({ kind: "staff" as const, staffId: s.id, moraleDelta: -4 })),
    ];
    return {
      severity: "minor",
      playerText: `A cutpurse got into the cash box; about ${formatCp(loss)} gone.`,
      dmText: `Theft of ${formatCp(loss)}. Successful thieves make the business a slightly more attractive target.`,
      effects,
    };
  },
};

const badBatch: ConditionalEventDef = {
  id: "bad-batch",
  title: "Customer complaint",
  category: "conditional",
  provenance: P,
  phase: "evening",
  cooldownDays: 10,
  pacing: "adverse",
  hazard(ctx) {
    const today = ctx.today;
    if (!today?.operating || today.sold === 0) return { probability: 0, drivers: [] };
    const base = 0.004;
    const competence = ctx.derived.staffCompetence;
    const service = 1 + Math.max(0, 50 - competence) / 20;
    const quality = ctx.plan.quality === 1 ? 1.8 : 1;
    const supplier = ctx.plan.suppliers === 1 ? 1.2 : 1;
    const shortage = today.shortage ? 1.5 : 1;
    const p = base * service * quality * supplier * shortage;
    return {
      probability: p,
      drivers: [
        { label: "Baseline", value: base },
        { label: "Staff handling and holding", value: base * (service - 1) },
        { label: "Cheapest ingredients", value: base * service * (quality - 1) },
        { label: "Single supplier", value: base * service * quality * (supplier - 1) },
        { label: "Substitute ingredients during a shortage", value: base * service * quality * supplier * (shortage - 1) },
      ].filter((d) => d.value !== 0),
    };
  },
  resolve(ctx) {
    const enforcementBump = ctx.neighborhood.enforcement > 0.5 ? 3 : 0;
    return {
      severity: "notable",
      playerText: "A customer fell ill and blamed one of our pies. People are talking.",
      dmText: `Food complaint: reputation −6, scrutiny +${5 + enforcementBump}. Recent-complaint condition makes inspections harsher for two weeks.`,
      effects: [
        { kind: "adjust", variable: "reputation", delta: -6 },
        { kind: "adjust", variable: "scrutiny", delta: 5 + enforcementBump },
        { kind: "addCondition", id: "recent-complaint", label: "Recent food complaint", durationDays: 14, visibleToPlayers: true },
      ],
    };
  },
};

const notablePraise: ConditionalEventDef = {
  id: "notable-praise",
  title: "Word from a notable patron",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 28,
  pacing: "flavor",
  hazard(ctx) {
    const q = ctx.plan.quality;
    const base = q >= 4 ? 0.18 : q === 3 ? 0.05 : 0.01;
    const rep = clamp01((ctx.state.business.hidden.reputation - 60) / 30);
    const place = ctx.neighborhood.id === "high-march" ? 1.5 : 1;
    return {
      probability: base * rep * place,
      drivers: [
        { label: `Quality tier ${q}`, value: base },
        { label: "Reputation above 60", value: rep },
        { label: "Wealthy clientele", value: place },
      ],
    };
  },
  resolve() {
    return {
      severity: "notable",
      playerText: "A well-dressed patron sent a servant back for a dozen more, and apparently mentioned us at a supper party.",
      dmText: "Praise from a notable: visibility +8, reputation +3.",
      effects: [
        { kind: "adjust", variable: "visibility", delta: 8 },
        { kind: "adjust", variable: "reputation", delta: 3 },
      ],
    };
  },
};

const largeOrder: ConditionalEventDef = {
  id: "large-order",
  title: "A large order",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 21,
  pacing: "decision",
  hazard(ctx) {
    const h = ctx.state.business.hidden;
    const rep = clamp01((h.reputation - 45) / 35);
    const vis = clamp01(h.visibility / 60);
    const guild = { none: 1, associate: 1.2, member: 1.4 }[ctx.plan.guild];
    return {
      probability: 0.2 * rep * vis * guild,
      drivers: [
        { label: "Reputation above 45", value: rep },
        { label: "Visibility", value: vis },
        { label: "Guild connections", value: guild },
      ],
    };
  },
  resolve(ctx, rng) {
    const qty = rng.int(15, 30) * 10;
    const price = Math.max(1, Math.round(fairPrice(ctx.world, ctx.neighborhood, ctx.plan.quality) * 0.85 * 10) / 10);
    const who = rng.pick(["an innkeeper hosting a wedding", "a guildhall banquet steward", "a temple kitchen preparing a feast day", "a caravan master provisioning a journey"]);
    return {
      severity: "notable",
      playerText: `${who[0]!.toUpperCase()}${who.slice(1)} asks for ${qty} pies in three days at ${formatCp(price)} each.`,
      dmText: `Opportunity: ${qty} pies @ ${price} cp. Delivery succeeds if the constructs have spare capacity over three days.`,
      effects: [],
      decision: {
        authority: "players",
        prompt: `Accept an order for ${qty} pies (${formatCp(qty * price)}) due in three days?`,
        standingOrder: "largeOrder",
        defaultOptionId: "accept",
        respondWithinDays: 1,
        options: [
          { id: "accept", label: "Accept", description: "Bake the extra batch and deliver.", effects: [{ kind: "schedule", eventId: "large-order-delivery", inDays: 2, data: { qty, priceCp: price, who } }] },
          { id: "decline", label: "Decline politely", description: "Keep the regular schedule.", effects: [] },
        ],
      },
    };
  },
};

const skimmingNoticed: ConditionalEventDef = {
  id: "skimming-noticed",
  title: "Takings don't add up",
  category: "emergent",
  provenance: P,
  phase: "weekly",
  cooldownDays: 21,
  pacing: "decision",
  hazard(ctx) {
    if (ctx.plan.oversight === "hands-off") return { probability: 0, drivers: [{ label: "Nobody checks the books", value: 0 }] };
    const suspect = [...ctx.state.business.staff].sort((a, b) => b.skimmedCp - a.skimmedCp)[0];
    if (!suspect || suspect.skimmedCp < 250 || hasActiveCondition(ctx.state, `warned:${suspect.id}`, ctx.date.absoluteDay)) return { probability: 0, drivers: [] };
    const p = ctx.plan.oversight === "frequent" ? 0.5 : 0.25;
    return { probability: p, drivers: [{ label: `${ctx.plan.oversight} oversight of the books`, value: p }] };
  },
  resolve(ctx) {
    const suspect = [...ctx.state.business.staff].sort((a, b) => b.skimmedCp - a.skimmedCp)[0]!;
    const shortfall = Math.round(suspect.skimmedCp / 10) * 10;
    return {
      severity: "notable",
      playerText: `Counting pies sent out against coin brought back, the takings come up short — roughly ${formatCp(shortfall)} over recent weeks. The ${suspect.role} handled most of that cash.`,
      dmText: `${suspect.name} (honesty ${suspect.traits.honesty}) has skimmed ${formatCp(suspect.skimmedCp)} in total.`,
      sessionHook: "Players may want to tail the employee, set a trap, or confront them in person.",
      effects: [{ kind: "reveal", topic: "staff", text: `Takings are short by roughly ${formatCp(shortfall)}; ${suspect.name} handled most of the cash.` }],
      decision: {
        authority: "players",
        prompt: `The takings are short. What do we do about ${suspect.name}?`,
        standingOrder: "dishonestStaff",
        defaultOptionId: "warn",
        respondWithinDays: 7,
        options: [
          {
            id: "dismiss",
            label: `Dismiss ${suspect.name}`,
            description: "Let them go; their outlet is short-staffed until someone is hired.",
            effects: [{ kind: "plan", patch: { staff: ctx.plan.staff.filter((s) => s.candidateId !== suspect.id) }, note: `Dismissed ${suspect.name}` }],
          },
          {
            id: "warn",
            label: "Have a firm word",
            description: "Make it clear someone is counting.",
            effects: [
              { kind: "staff", staffId: suspect.id, moraleDelta: -10, loyaltyDelta: -5 },
              { kind: "addCondition", id: `warned:${suspect.id}`, label: `${suspect.name} warned`, durationDays: 42, visibleToPlayers: true },
            ],
          },
          { id: "ignore", label: "Let it go", description: "Maybe it was a counting mistake.", effects: [] },
        ],
      },
    };
  },
};

const staffQuits: ConditionalEventDef = {
  id: "staff-quits",
  title: "Staff member quits",
  category: "conditional",
  provenance: P,
  phase: "weekly",
  cooldownDays: 7,
  pacing: "flavor",
  hazard(ctx) {
    const k = ctx.world.assumptions.dynamics.staff;
    const unhappy = ctx.state.business.staff.filter((s) => s.lowMoraleWeeks >= k.quitAfterWeeks);
    return { probability: unhappy.length ? 0.6 : 0, drivers: unhappy.map((s) => ({ label: `${s.name}: morale low for ${s.lowMoraleWeeks} weeks`, value: 0.6 })) };
  },
  resolve(ctx) {
    const k = ctx.world.assumptions.dynamics.staff;
    const who = ctx.state.business.staff.filter((s) => s.lowMoraleWeeks >= k.quitAfterWeeks).sort((a, b) => a.morale - b.morale)[0]!;
    return {
      severity: "notable",
      playerText: `${who.name} quit, saying the work isn't worth the pay or the trouble.`,
      dmText: `${who.name} quit after ${who.lowMoraleWeeks} weeks of morale below ${k.quitMorale}.`,
      effects: [{ kind: "plan", patch: { staff: ctx.plan.staff.filter((s) => s.candidateId !== who.id) }, note: `${who.name} quit` }],
    };
  },
};

const protectionFeeReview: ConditionalEventDef = {
  id: "protection-fee-review",
  title: "The crew wants more",
  category: "emergent",
  provenance: P,
  phase: "weekly",
  cooldownDays: 28,
  pacing: "adverse",
  hazard(ctx) {
    const deal = ctx.state.conditions.find((c) => c.id === "paying-protection");
    if (!deal || typeof deal.data?.feeCp !== "number") return { probability: 0, drivers: [] };
    const revenue = ctx.week ? ctx.week.ledger.revenue : 0;
    const growth = revenue > (deal.data.feeCp as number) / 0.06 ? 0.2 : 0;
    return { probability: growth, drivers: [{ label: "Takings have outgrown the agreed fee", value: growth }] };
  },
  resolve(ctx) {
    const deal = ctx.state.conditions.find((c) => c.id === "paying-protection")!;
    const revenue = ctx.week ? ctx.week.ledger.revenue : 0;
    const fee = Math.max(deal.data!.feeCp as number, Math.round((revenue * 0.08) / 10) * 10);
    return {
      severity: "notable",
      playerText: `The collector says business looks good — and the weekly 'contribution' is now ${formatCp(fee)}.`,
      dmText: `Protection fee raised from ${formatCp(deal.data!.feeCp as number)} to ${formatCp(fee)} as revenue grew.`,
      effects: [{ kind: "addCondition", id: "paying-protection", label: deal.label, data: { ...deal.data, feeCp: fee }, visibleToPlayers: true }],
    };
  },
};

const vacancyFilled: ConditionalEventDef = {
  id: "vacancy-filled",
  title: "A replacement is hired",
  category: "conditional",
  provenance: P,
  phase: "weekly",
  cooldownDays: 0,
  pacing: "flavor",
  hazard(ctx) {
    if (ctx.plan.standingOrders.fillVacancies !== "auto") return { probability: 0, drivers: [] };
    const missing = vacantRoles(ctx);
    return { probability: missing.length ? 0.7 : 0, drivers: missing.map((r) => ({ label: `No ${r} for an outlet that needs one`, value: 0.7 })) };
  },
  resolve(ctx) {
    const role = vacantRoles(ctx)[0]!;
    const hired = new Set(ctx.plan.staff.map((s) => s.candidateId));
    const candidate = ctx.world.staffPool.filter((c) => !hired.has(c.id) && c.roles.includes(role)).sort((a, b) => a.askingWageCpPerDay - b.askingWageCpPerDay || a.id.localeCompare(b.id))[0];
    if (!candidate) {
      return {
        severity: "notable",
        playerText: `We couldn't find anyone to work as a ${role}; an outlet stays short-handed.`,
        dmText: "Hiring pool exhausted for this role.",
        effects: [{ kind: "plan", patch: { standingOrders: { fillVacancies: "manual" } }, note: "No candidates left; stop searching" }],
      };
    }
    return {
      severity: "minor",
      playerText: `We hired ${candidate.name} as a ${role} (${candidate.askingWageCpPerDay} cp/day) to fill the gap.`,
      dmText: `Standing order "fill vacancies": hired the cheapest available ${role}. Traits hidden: honesty ${candidate.traits.honesty}, reliability ${candidate.traits.reliability}.`,
      effects: [{ kind: "plan", patch: { staff: [...ctx.plan.staff, { candidateId: candidate.id, role, wageCpPerDay: candidate.askingWageCpPerDay }] }, note: `Hired ${candidate.name} to fill a vacancy` }],
    };
  },
};

/** Roles with fewer staff than outlets that need them (e.g. two outlets, one seller). */
function vacantRoles(ctx: Parameters<ConditionalEventDef["hazard"]>[0]) {
  const needed = new Map<string, number>();
  for (const c of ctx.plan.channels) if (c.share > 0) needed.set(ctx.world.channels[c.type].staffRole, (needed.get(ctx.world.channels[c.type].staffRole) ?? 0) + 1);
  return [...needed.entries()]
    .filter(([role, outlets]) => ctx.plan.staff.filter((s) => s.role === role).length < outlets)
    .map(([role]) => role as (typeof ctx.plan.staff)[number]["role"])
    .sort();
}

export const conditionalEvents: ConditionalEventDef[] = [
  staffAbsence,
  supplyShortage,
  unexpectedCrowd,
  pettyTheft,
  badBatch,
  notablePraise,
  largeOrder,
  skimmingNoticed,
  staffQuits,
  protectionFeeReview,
  vacancyFilled,
];

// Exposed for the large-order delivery check.
export function spareCapacity(ctx: Parameters<ConditionalEventDef["hazard"]>[0], days: number): number {
  const daily = productionCapacity(ctx.world, ctx.state, ctx.date.absoluteDay);
  const planned = ctx.plan.weeklyProduction / ctx.plan.operatingDays;
  return Math.max(0, (daily - planned) * days);
}

export function unitCostToday(ctx: Parameters<ConditionalEventDef["hazard"]>[0]): number {
  const idx = ingredientPriceIndex(ctx.world.market, ctx.world.calendar, ctx.state.market, ctx.date.dayOfYear);
  return unitIngredientCost(ctx.world, ctx.state, ctx.plan, idx, ctx.date.absoluteDay) + ctx.world.assumptions.fuelCostPerPieCp;
}
