/**
 * Dilemmas: small A-or-B choices, about one a month, that move the dial. Each offers a
 * safe option and a risky one, and each is triggered by something that really happened
 * (selling out, throwing pies away) or by an ordinary opportunity of street life.
 * If nobody answers in time, the manager plays it safe. PROPOSED content; numbers
 * provisional.
 *
 * Risky outcomes that depend on luck are settled later by "gamble-outcome" (a scheduled
 * event), so the result arrives as news a week or two on.
 */
import { dailyConstructCapacity } from "../../engine/economy";
import { formatCp } from "../../engine/math";
import { proposed } from "../../engine/provenance";
import type { ConditionalEventDef, EventContext, ScheduledEventDef } from "../../engine/types";

const P = proposed("Proposed monthly dilemma (safe or risky choice).");

/** Grows from 0 to 1 over the six weeks after the party's last decision, so choices arrive about monthly. */
function sinceLastChoice(ctx: EventContext): number {
  const last = ctx.state.pacing.lastPlayerDecisionDay ?? ctx.state.startDay;
  return Math.min(1, Math.max(0, (ctx.date.absoluteDay - last) / 42));
}

function productionRoom(ctx: EventContext): number {
  const stage = ctx.world.stages[ctx.plan.stage];
  const cap = Math.min(stage?.maxWeeklyProduction ?? Infinity, Math.floor(dailyConstructCapacity(ctx.world, ctx.plan) * ctx.plan.operatingDays));
  return Math.max(0, cap - ctx.plan.weeklyProduction);
}

const tens = (n: number) => Math.floor(n / 10) * 10;
const weekNumber = (ctx: EventContext) => ctx.state.weeks.length;

const sellingOut: ConditionalEventDef = {
  id: "dilemma-selling-out",
  title: "Selling out early",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 42,
  pacing: "decision",
  hazard(ctx) {
    const days = ctx.week?.days ?? [];
    const soldOut = days.filter((d) => d.operating && d.produced > 0 && d.sold >= d.produced).length;
    const quiet = sinceLastChoice(ctx);
    return { probability: soldOut >= 3 ? 0.8 * quiet : 0, drivers: [{ label: "Days we sold out this week", value: soldOut }, { label: "Time since the party's last choice", value: quiet }] };
  },
  resolve(ctx) {
    const days = ctx.week?.days ?? [];
    const soldOut = days.filter((d) => d.operating && d.produced > 0 && d.sold >= d.produced).length;
    const room = productionRoom(ctx);
    const p = ctx.plan;
    const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
    const options =
      room >= 30
        ? [
            { id: "safe", label: `Bake ${tens(Math.min(50, room))} more a week`, description: "A few more pies, same price. Little risk.", effects: [{ kind: "plan" as const, patch: { weeklyProduction: p.weeklyProduction + tens(Math.min(50, room)) }, note: "Baking a few more" }] },
            {
              id: "risky",
              label: `Bake ${tens(Math.min(150, room))} more and charge a copper more`,
              description: "More pies and more per pie. If the crowds thin, we'll be throwing pies away.",
              effects: [{ kind: "plan" as const, patch: { weeklyProduction: p.weeklyProduction + tens(Math.min(150, room)), priceCp: p.priceCp + 1 }, note: "Baking a lot more, a copper dearer" }],
            },
          ]
        : [
            { id: "safe", label: "Keep the price where it is", description: "We're baking all we can. The regulars appreciate a fair price, even if some go home without a pie.", effects: [] },
            { id: "risky", label: "Charge two coppers more", description: `More per pie and fewer turned away, but push too far and they'll walk to ${rival}.`, effects: [{ kind: "plan" as const, patch: { priceCp: p.priceCp + 2 }, note: "Two coppers dearer" }] },
          ];
    return {
      severity: "notable",
      playerText: `We sold out early on ${soldOut} days this week and turned people away.`,
      dmText: `Dilemma: sold out ${soldOut} of ${days.length} days. Room to bake ${room} more a week within the business size and construct capacity.`,
      effects: [],
      decision: { authority: "players", prompt: "We keep selling out. What should we do?", defaultOptionId: "safe", respondWithinDays: 14, options },
    };
  },
};

const throwingAway: ConditionalEventDef = {
  id: "dilemma-waste",
  title: "Throwing pies away",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 42,
  pacing: "decision",
  hazard(ctx) {
    const days = ctx.week?.days ?? [];
    const produced = days.reduce((a, d) => a + d.produced, 0);
    const waste = days.reduce((a, d) => a + d.waste, 0);
    const share = produced > 0 ? waste / produced : 0;
    const quiet = sinceLastChoice(ctx);
    return { probability: share >= 0.25 && weekNumber(ctx) >= 1 ? 0.8 * Math.max(quiet, 0.5) : 0, drivers: [{ label: "Share of pies thrown away this week", value: share }, { label: "Time since the party's last choice", value: quiet }] };
  },
  resolve(ctx) {
    const days = ctx.week?.days ?? [];
    const waste = days.reduce((a, d) => a + d.waste, 0);
    // A small adjustment, not a fix-all: about a tenth of the batch, never below 100 a week.
    const cut = Math.max(10, Math.min(Math.max(30, tens(ctx.plan.weeklyProduction * 0.1)), ctx.plan.weeklyProduction - 100));
    const crier = 300;
    return {
      severity: "notable",
      playerText: `We threw out ${waste} unsold pies this week.`,
      dmText: `Dilemma: ${waste} pies wasted. Safe: cut production by ${cut}. Risky: a crier for a month (${formatCp(crier)}) to grow demand.`,
      effects: [],
      decision: {
        authority: "players",
        prompt: "Too many pies are going in the bin. What should we do?",
        defaultOptionId: "safe",
        respondWithinDays: 14,
        options: [
          { id: "safe", label: `Bake ${cut} fewer a week`, description: "A little less waste. If we're still throwing pies away, we can trim again.", effects: [{ kind: "plan", patch: { weeklyProduction: ctx.plan.weeklyProduction - cut }, note: "Baking fewer" }] },
          {
            id: "risky",
            label: `Keep baking and hire a crier for a month (${formatCp(crier)})`,
            description: "If more people hear of us, those pies sell. If not, it's money down the drain.",
            effects: [
              { kind: "cash", amountCp: -crier, category: "advertising", note: "A crier for a month" },
              { kind: "adjust", variable: "visibility", delta: 8 },
              { kind: "modifier", id: "crier", label: "A crier shouting our name", target: "demand", multiplier: 1.15, durationDays: 28 },
            ],
          },
        ],
      },
    };
  },
};

const busyCorner: ConditionalEventDef = {
  id: "dilemma-busy-corner",
  title: "A busier corner",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 84,
  pacing: "decision",
  hazard(ctx) {
    const hasCart = ctx.plan.channels.some((c) => c.type === "cart" && c.share > 0);
    const quiet = sinceLastChoice(ctx);
    return { probability: hasCart && weekNumber(ctx) >= 4 && !ctx.hasCondition("busy-corner") ? 0.25 * quiet : 0, drivers: [{ label: "We run a cart", value: hasCart ? 1 : 0 }, { label: "Time since the party's last choice", value: quiet }] };
  },
  resolve(ctx) {
    const n = ctx.neighborhood;
    const fee = Math.max(150, tens(n.permitFeeCpPerWeek * 2));
    const rough = n.crime >= 0.3;
    return {
      severity: "notable",
      playerText: `The corner by the fountain in ${n.name} is free this month: twice the foot traffic, ${rough ? "but the local toughs hang about there" : "but the inspectors walk past it every day"}.`,
      dmText: `Dilemma: demand ×1.3 at the cart for 28 days for ${formatCp(fee)}; ${rough ? "criminal attention rises" : "official scrutiny rises"}.`,
      effects: [],
      decision: {
        authority: "players",
        prompt: "Move the cart to the busy corner for a month?",
        defaultOptionId: "safe",
        respondWithinDays: 7,
        options: [
          { id: "safe", label: "Stay where we are", description: "Our regulars know where to find us.", effects: [] },
          {
            id: "risky",
            label: `Take the corner (${formatCp(fee)})`,
            description: rough ? "More customers, and more eyes on our cash box." : "More customers, and more officials looking at our paperwork.",
            effects: [
              { kind: "cash", amountCp: -fee, category: "stallFees", note: "The fountain corner" },
              { kind: "modifier", id: "busy-corner", label: "Trading on the busy corner", target: "demand", channel: "cart", multiplier: 1.3, durationDays: 28 },
              { kind: "addCondition", id: "busy-corner", label: "On the busy corner", durationDays: 28, visibleToPlayers: true },
              rough ? { kind: "adjust", variable: "criminalAttention", delta: Math.round(25 * n.crime) } : { kind: "adjust", variable: "scrutiny", delta: 8 },
            ],
          },
        ],
      },
    };
  },
};

const cheapMeat: ConditionalEventDef = {
  id: "dilemma-cheap-meat",
  title: "Cheap meat, no questions asked",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 112,
  pacing: "decision",
  hazard(ctx) {
    const quiet = sinceLastChoice(ctx);
    return { probability: weekNumber(ctx) >= 3 && ctx.plan.quality <= 3 ? 0.2 * quiet : 0, drivers: [{ label: "Plain enough pies for a drover's offer", value: ctx.plan.quality <= 3 ? 1 : 0 }, { label: "Time since the party's last choice", value: quiet }] };
  },
  resolve(ctx, rng) {
    const inDays = rng.int(8, 20);
    return {
      severity: "notable",
      playerText: "A drover offers mutton at a third off the usual price. He won't say where it came from.",
      dmText: `Dilemma: ingredients ×0.7 for 28 days; a gamble resolves in ${inDays} days (35% chance someone falls ill).`,
      effects: [],
      decision: {
        authority: "players",
        prompt: "Buy the drover's cheap mutton for a month?",
        defaultOptionId: "safe",
        respondWithinDays: 7,
        options: [
          { id: "safe", label: "Turn him away", description: "We know our butcher.", effects: [] },
          {
            id: "risky",
            label: "Buy it for a month",
            description: "A fat saving on every pie, if the meat is what he says it is.",
            effects: [
              { kind: "modifier", id: "cheap-meat", label: "The drover's cheap mutton", target: "ingredientCost", multiplier: 0.7, durationDays: 28 },
              { kind: "schedule", eventId: "gamble-outcome", inDays, data: { gamble: "cheap-meat" } },
            ],
          },
        ],
      },
    };
  },
};

const newRecipe: ConditionalEventDef = {
  id: "dilemma-new-recipe",
  title: "A new recipe",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 112,
  pacing: "decision",
  hazard(ctx) {
    const staff = ctx.state.business.staff;
    const keen = staff.some((s) => s.morale >= 45);
    const quiet = sinceLastChoice(ctx);
    return { probability: weekNumber(ctx) >= 5 && keen ? 0.2 * quiet : 0, drivers: [{ label: "A seller keen to try something", value: keen ? 1 : 0 }, { label: "Time since the party's last choice", value: quiet }] };
  },
  resolve(ctx) {
    const who = [...ctx.state.business.staff].sort((a, b) => b.morale - a.morale)[0]!;
    return {
      severity: "notable",
      playerText: `${who.name} wants to sell a spiced pie of their own recipe for a week.`,
      dmText: "Dilemma: a recipe gamble resolves in 7 days (55% a hit: reputation +5; 45% a flop: reputation −3). Saying no costs a little morale.",
      effects: [],
      decision: {
        authority: "players",
        prompt: `Let ${who.name} try their spiced pie?`,
        defaultOptionId: "safe",
        respondWithinDays: 7,
        options: [
          { id: "safe", label: "Stick to what works", description: `Our pie sells. ${who.name} will be a little disappointed.`, effects: [{ kind: "staff", staffId: who.id, moraleDelta: -3 }] },
          { id: "risky", label: "Let them try it for a week", description: "It could become a favorite, or the regulars could hate it.", effects: [{ kind: "schedule", eventId: "gamble-outcome", inDays: 7, data: { gamble: "recipe", staffId: who.id } }] },
        ],
      },
    };
  },
};

const streetPerformer: ConditionalEventDef = {
  id: "dilemma-performer",
  title: "A street performer",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 84,
  pacing: "decision",
  hazard(ctx) {
    const street = ctx.plan.channels.some((c) => (c.type === "cart" || c.type === "stall") && c.share > 0);
    const quiet = sinceLastChoice(ctx);
    return { probability: street && weekNumber(ctx) >= 2 ? 0.2 * quiet : 0, drivers: [{ label: "We sell on the street", value: street ? 1 : 0 }, { label: "Time since the party's last choice", value: quiet }] };
  },
  resolve() {
    const fee = 200;
    return {
      severity: "notable",
      playerText: "A juggler offers to work beside our pitch for a week and send the crowd our way.",
      dmText: `Dilemma: demand ×1.3 for 7 days for ${formatCp(fee)}; a gamble resolves in 3 days (20% a mishap).`,
      effects: [],
      decision: {
        authority: "players",
        prompt: `Pay the juggler ${formatCp(fee)} for a week?`,
        defaultOptionId: "safe",
        respondWithinDays: 5,
        options: [
          { id: "safe", label: "No, thank you", description: "We'll sell pies the usual way.", effects: [] },
          {
            id: "risky",
            label: `Hire the juggler (${formatCp(fee)})`,
            description: "Crowds stop to watch, then buy. Usually.",
            effects: [
              { kind: "cash", amountCp: -fee, category: "advertising", note: "A juggler for a week" },
              { kind: "modifier", id: "juggler", label: "A juggler drawing a crowd", target: "demand", multiplier: 1.3, durationDays: 7 },
              { kind: "schedule", eventId: "gamble-outcome", inDays: 3, data: { gamble: "juggler" } },
            ],
          },
        ],
      },
    };
  },
};

/** How a risky choice turned out. */
export const gambleOutcome: ScheduledEventDef = {
  id: "gamble-outcome",
  title: "How it turned out",
  category: "emergent",
  provenance: P,
  resolve(ctx, rng, data) {
    const roll = rng.next();
    switch (String(data.gamble)) {
      case "cheap-meat":
        return roll < 0.35
          ? {
              severity: "notable",
              title: "The cheap mutton",
              playerText: "A customer fell ill and blamed our pies. People are talking, and someone mentioned the drover's mutton.",
              dmText: `Gamble lost (roll ${roll.toFixed(2)} < 0.35): reputation −8, scrutiny +10, demand ×0.85 for 14 days.`,
              effects: [
                { kind: "adjust", variable: "reputation", delta: -8 },
                { kind: "adjust", variable: "scrutiny", delta: 10 },
                { kind: "adjust", variable: "visibility", delta: 3 },
                { kind: "modifier", id: "bad-meat-talk", label: "Talk of bad meat", target: "demand", multiplier: 0.85, durationDays: 14 },
              ],
            }
          : { severity: "minor", title: "The cheap mutton", playerText: "The drover's mutton went down fine. Nobody asked where it came from.", dmText: `Gamble won (roll ${roll.toFixed(2)}).`, effects: [] };
      case "recipe": {
        const staffId = String(data.staffId);
        const name = ctx.state.business.staff.find((s) => s.id === staffId)?.name ?? "Our seller";
        return roll < 0.55
          ? {
              severity: "notable",
              title: "The spiced pie",
              playerText: `${name}'s spiced pie was a hit. People ask for it by name.`,
              dmText: `Gamble won (roll ${roll.toFixed(2)} < 0.55): reputation +5, visibility +4, morale +10.`,
              effects: [
                { kind: "adjust", variable: "reputation", delta: 5 },
                { kind: "adjust", variable: "visibility", delta: 4 },
                { kind: "staff", staffId, moraleDelta: 10, loyaltyDelta: 4 },
              ],
            }
          : {
              severity: "notable",
              title: "The spiced pie",
              playerText: `Nobody liked ${name}'s spiced pie. Back to the old recipe, and ${name} took it well.`,
              dmText: `Gamble lost (roll ${roll.toFixed(2)}): reputation −3, morale +4 for being asked.`,
              effects: [
                { kind: "adjust", variable: "reputation", delta: -3 },
                { kind: "staff", staffId, moraleDelta: 4 },
              ],
            };
      }
      case "juggler":
        return roll < 0.2
          ? {
              severity: "minor",
              title: "The juggler",
              playerText: "A flaming club landed in a basket of pies. The crowd loved it; we lost a basket and a little dignity.",
              dmText: `Mishap (roll ${roll.toFixed(2)} < 0.2): −1 gp, reputation −2.`,
              effects: [
                { kind: "cash", amountCp: -100, category: "losses", note: "A singed basket of pies" },
                { kind: "adjust", variable: "reputation", delta: -2 },
              ],
            }
          : { severity: "minor", title: "The juggler", playerText: "The juggler drew a crowd all week, and plenty of them bought a pie.", dmText: `No mishap (roll ${roll.toFixed(2)}): visibility +5.`, effects: [{ kind: "adjust", variable: "visibility", delta: 5 }] };
      default:
        return { severity: "minor", playerText: "", dmText: `Unknown gamble ${String(data.gamble)}`, effects: [], visibleToPlayers: false };
    }
  },
};

export const dilemmaEvents: ConditionalEventDef[] = [sellingOut, throwingAway, busyCorner, cheapMeat, newRecipe, streetPerformer];
