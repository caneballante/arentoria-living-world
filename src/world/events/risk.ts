/**
 * Risk and reward: events that widen the spread of outcomes for bold plans.
 *  - Upside: showcased magical chefs occasionally draw crowds (spectacle).
 *  - Downside: pushed constructs break down; visible, unguarded cash gets robbed.
 * All PROPOSED content; magnitudes PROVISIONAL. Costs scale with the business so that
 * consequences matter at any size.
 */
import { clamp01 } from "../../engine/math";
import { proposed } from "../../engine/provenance";
import type { ConditionalEventDef, Effect } from "../../engine/types";
import { avgWeeklyRevenue, formatCp, isOperatingDay, vendors } from "./helpers";

const P = proposed("Risk/reward content is proposed; magnitudes are provisional.");

const constructMalfunction: ConditionalEventDef = {
  id: "construct-malfunction",
  title: "A construct breaks down",
  category: "conditional",
  provenance: P,
  phase: "morning",
  cooldownDays: 7,
  pacing: "flavor",
  hazard(ctx) {
    if (!isOperatingDay(ctx)) return { probability: 0, drivers: [] };
    const strain = ctx.state.business.hidden.constructStrain;
    const base = 0.0008;
    const wear = 0.0005 * Math.max(0, strain - 15);
    return {
      probability: base + wear,
      drivers: [
        { label: "Ordinary wear on magical machinery", value: base },
        { label: `Construct strain ${Math.round(strain)}`, value: wear },
      ],
    };
  },
  resolve(ctx, rng) {
    const strain = ctx.state.business.hidden.constructStrain;
    const showcased = ctx.plan.constructPublicity === "showcased";
    const licensed = ctx.state.business.licensing.status === "approved";
    // Worse strain → worse breakdowns.
    const roll = rng.next() + strain / 200;
    if (roll < 0.85) {
      const days = rng.int(2, 4);
      const [lo, hi] = ctx.world.assumptions.repairs.minorBreakdownCp;
      const repair = rng.int(lo / 10, hi / 10) * 10;
      return {
        severity: "minor",
        playerText: `One of the constructs seized up mid-batch; it will take ${days} days and ${formatCp(repair)} in reagents to set right.`,
        dmText: `Minor malfunction (strain ${Math.round(strain)}): a third of capacity lost for ${days} days.`,
        effects: [
          { kind: "modifier", id: "construct-down", label: "A construct under repair", target: "productionCap", multiplier: 0.67, durationDays: days },
          { kind: "cash", amountCp: -repair, category: "equipment", note: "Construct repair" },
          { kind: "adjust", variable: "constructStrain", delta: -20 },
        ],
      };
    }
    // At severe strain a major breakdown can become a kitchen fire — the tail risk of pushing.
    if (strain >= 30 && rng.next() < (strain - 25) / 40) {
      const closed = rng.int(28, 49);
      const [lo, hi] = ctx.world.assumptions.repairs.kitchenFireCp;
      const repairs = rng.int(lo / 100, hi / 100) * 100;
      return {
        severity: "major",
        title: "Fire in the kitchen",
        playerText: `An overheated construct set the kitchen alight. Nobody was hurt, but the kitchen is out of action for about ${Math.round(closed / 7)} weeks and repairs will cost ${formatCp(repairs)}.`,
        dmText: `Kitchen fire (strain ${Math.round(strain)}): production stops for ${closed} days; staff still paid. Simulated event in the party's (canon) rented house — the DM decides what it means for the house and the landlord.`,
        sessionHook: "The landlord of 17 Dawnfire Promenade will want words — and the neighbors will talk about the 'dangerous magic'.",
        effects: [
          { kind: "modifier", id: "kitchen-fire", label: "Kitchen closed after a fire", target: "productionCap", multiplier: 0.0, durationDays: closed },
          { kind: "cash", amountCp: -repairs, category: "equipment", note: "Fire repairs" },
          { kind: "adjust", variable: "reputation", delta: -5 },
          { kind: "adjust", variable: "visibility", delta: 6 },
          { kind: "adjust", variable: "scrutiny", delta: 10 },
          { kind: "adjust", variable: "constructStrain", delta: -100 },
        ],
      };
    }
    const days = rng.int(10, 21);
    const [lo, hi] = ctx.world.assumptions.repairs.artificerCp;
    const repair = rng.int(lo / 100, hi / 100) * 100;
    const effects: Effect[] = [
      { kind: "modifier", id: "construct-down", label: "A construct badly damaged", target: "productionCap", multiplier: 0.67, durationDays: days },
      { kind: "cash", amountCp: -repair, category: "equipment", note: "Artificer's repair" },
      { kind: "adjust", variable: "constructStrain", delta: -40 },
    ];
    if (showcased) effects.push({ kind: "adjust", variable: "visibility", delta: 5 }, { kind: "adjust", variable: "reputation", delta: -4 }, { kind: "adjust", variable: "scrutiny", delta: licensed ? 4 : 12 });
    return {
      severity: "major",
      playerText: `A construct overheated and wrecked half the kitchen${showcased ? " — in full view of the customers" : ""}. An artificer quotes ${formatCp(repair)} and ${days} days.`,
      dmText: `Major malfunction (strain ${Math.round(strain)}). ${showcased ? "Public spectacle: scrutiny rises, especially while unlicensed." : ""}`,
      sessionHook: "Finding an artificer who can fix (and keep quiet about) a magical chef could be its own errand.",
      effects,
    };
  },
};

const spectacle: ConditionalEventDef = {
  id: "construct-spectacle",
  title: "Crowds come to watch the magical chefs",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 35,
  pacing: "flavor",
  hazard(ctx) {
    if (ctx.plan.constructPublicity !== "showcased") return { probability: 0, drivers: [] };
    const vis = clamp01((ctx.state.business.hidden.visibility - 30) / 50);
    return { probability: 0.12 * vis, drivers: [{ label: "Magical chefs on show to a city that has noticed", value: 0.12 * vis }] };
  },
  resolve(ctx) {
    const licensed = ctx.state.business.licensing.status === "approved";
    return {
      severity: "notable",
      playerText: "Word has spread about the magical chefs: crowds are queuing just to watch them work, and buying while they wait.",
      dmText: `Demand ×1.6 for 7 days, visibility +8${licensed ? "" : ", scrutiny +6 (a licensing clerk was in the crowd)"}.`,
      effects: [
        { kind: "modifier", id: "spectacle", label: "Crowds watching the constructs", target: "demand", multiplier: 1.6, durationDays: 7 },
        { kind: "adjust", variable: "visibility", delta: 8 },
        ...(licensed ? [] : [{ kind: "adjust" as const, variable: "scrutiny" as const, delta: 6 }]),
      ],
    };
  },
};

const strongboxRobbery: ConditionalEventDef = {
  id: "strongbox-robbery",
  title: "The strongbox is robbed",
  category: "conditional",
  provenance: P,
  phase: "evening",
  cooldownDays: 42,
  pacing: "adverse",
  hazard(ctx) {
    const today = ctx.today;
    const ca = ctx.state.business.hidden.criminalAttention;
    if (!today?.operating || ca < 30) return { probability: 0, drivers: [] };
    const base = 0.0025 * (ca / 40) ** 2;
    const guards = ctx.state.business.staff.some((s) => s.role === "guard");
    const precautions = ctx.plan.security.precautions;
    const m = (precautions ? 0.3 : 1) * (guards ? 0.2 : 1);
    const drivers = [{ label: `Criminal attention ${Math.round(ca)}`, value: base }];
    if (m < 1) drivers.push({ label: "Lockbox, escorts and guards", value: -base * (1 - m) });
    return { probability: base * m, drivers };
  },
  resolve(ctx, rng) {
    // They take the strongbox: the cash on hand or most of a week's takings, whichever is worse.
    const share = rng.range(0.4, 0.7);
    const loss = Math.max(200, Math.round((Math.max(ctx.state.business.cashCp, avgWeeklyRevenue(ctx)) * share) / 10) * 10);
    const crew = ctx.actorName(ctx.neighborhood.crewActorId);
    return {
      severity: "major",
      playerText: `Thieves broke into the house overnight and emptied the business strongbox — ${formatCp(loss)} gone.`,
      dmText: `Robbery (likely ${crew} or someone they tipped off): ${formatCp(loss)}.`,
      sessionHook: `Track down the thieves — did ${crew} do it, or someone inside?`,
      effects: [
        { kind: "cash", amountCp: -loss, category: "losses", note: "Strongbox robbery" },
        { kind: "adjust", variable: "criminalAttention", delta: 3 },
        ...vendors(ctx).map((s) => ({ kind: "staff" as const, staffId: s.id, moraleDelta: -8 })),
      ],
    };
  },
};

export const riskEvents: ConditionalEventDef[] = [constructMalfunction, spectacle, strongboxRobbery];
