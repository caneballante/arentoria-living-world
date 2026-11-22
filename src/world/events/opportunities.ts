/**
 * Opportunities and dilemmas: decisions that are not threats, so a well-run, quiet
 * business still gives the party choices with trade-offs. All PROPOSED content;
 * probabilities PROVISIONAL. Most can wait a few days for an answer (response
 * windows), and unanswered ones fall back to the plan's standing orders.
 */
import { dateFromDay } from "../../engine/calendar";
import { fairPrice } from "../../engine/economy";
import { clamp01 } from "../../engine/math";
import { proposed } from "../../engine/provenance";
import type { ConditionalEventDef, EventContext, ScheduledEventDef } from "../../engine/types";
import { unitCostToday } from "./conditional";
import { formatCp } from "./helpers";

const P = proposed("Opportunity/dilemma content is proposed; probabilities are provisional.");

const weeksOpen = (ctx: EventContext) => ctx.state.weeks.length;

// ---------------------------------------------------------------------------

const raiseRequest: ConditionalEventDef = {
  id: "staff-raise-request",
  title: "A request for better pay",
  category: "emergent",
  provenance: P,
  phase: "weekly",
  cooldownDays: 56,
  pacing: "decision",
  hazard(ctx) {
    const candidates = ctx.state.business.staff.filter((s) => {
      const market = ctx.world.assumptions.marketWageCpPerDay[s.role];
      return ctx.date.absoluteDay - s.hiredDay >= 42 && s.competence >= 55 && s.wageCpPerDay < market * 1.15 && s.morale < 75;
    });
    const p = candidates.length ? 0.1 : 0;
    return { probability: p, drivers: candidates.map((s) => ({ label: `${s.name}: six weeks in, capable, modestly paid`, value: 0.1 })) };
  },
  resolve(ctx) {
    const who = [...ctx.state.business.staff]
      .filter((s) => ctx.date.absoluteDay - s.hiredDay >= 42 && s.competence >= 55)
      .sort((a, b) => b.competence - a.competence || a.id.localeCompare(b.id))[0]!;
    const hire = ctx.plan.staff.find((s) => s.candidateId === who.id)!;
    const full = Math.round(hire.wageCpPerDay * 1.25);
    const part = Math.round(hire.wageCpPerDay * 1.1);
    const withWage = (w: number) => ctx.plan.staff.map((s) => (s.candidateId === who.id ? { ...s, wageCpPerDay: w } : s));
    return {
      severity: "notable",
      playerText: `${who.name} asks for a raise: they've been reliable, the work is hard, and other sellers pay more.`,
      dmText: `${who.name} (competence ${Math.round(who.competence)}, morale ${Math.round(who.morale)}, loyalty ${Math.round(who.loyalty)}) wants ${full} cp/day.`,
      effects: [],
      decision: {
        authority: "players",
        prompt: `${who.name} wants a raise from ${hire.wageCpPerDay} to ${full} cp a day. Our answer?`,
        standingOrder: "raiseRequest",
        defaultOptionId: "partial",
        respondWithinDays: 7,
        options: [
          {
            id: "grant",
            label: `Grant it (${full} cp/day)`,
            description: "Costs more; buys loyalty.",
            effects: [{ kind: "plan", patch: { staff: withWage(full) }, note: `Raise for ${who.name}` }, { kind: "staff", staffId: who.id, moraleDelta: 15, loyaltyDelta: 10 }],
          },
          {
            id: "partial",
            label: `Meet halfway (${part} cp/day)`,
            description: "A compromise.",
            effects: [{ kind: "plan", patch: { staff: withWage(part) }, note: `Small raise for ${who.name}` }, { kind: "staff", staffId: who.id, moraleDelta: 5, loyaltyDelta: 3 }],
          },
          { id: "refuse", label: "Refuse", description: "Keep wages where they are.", effects: [{ kind: "staff", staffId: who.id, moraleDelta: -15, loyaltyDelta: -8 }] },
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

const staffPoached: ConditionalEventDef = {
  id: "staff-poached",
  title: "A rival tries to hire away our best",
  category: "emergent",
  provenance: P,
  phase: "weekly",
  cooldownDays: 84,
  pacing: "decision",
  hazard(ctx) {
    const star = [...ctx.state.business.staff].filter((s) => s.competence >= 68 && ctx.date.absoluteDay - s.hiredDay >= 28).sort((a, b) => b.competence - a.competence)[0];
    const p = star ? 0.035 * (0.5 + ctx.neighborhood.competition) : 0;
    return { probability: p, drivers: star ? [{ label: `${star.name} is skilled and noticed by competitors`, value: p }] : [] };
  },
  resolve(ctx) {
    const who = [...ctx.state.business.staff].filter((s) => s.competence >= 68).sort((a, b) => b.competence - a.competence || a.id.localeCompare(b.id))[0]!;
    const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
    const hire = ctx.plan.staff.find((s) => s.candidateId === who.id)!;
    const offer = Math.round(hire.wageCpPerDay * 1.3);
    const loyal = who.loyalty >= 50;
    const without = ctx.plan.staff.filter((s) => s.candidateId !== who.id);
    return {
      severity: "notable",
      playerText: `${rival} have offered ${who.name} ${offer} cp a day to come and work for them.`,
      dmText: `${who.name}: loyalty ${Math.round(who.loyalty)} (${loyal ? "would stay if asked" : "will leave unless paid"}), competence ${Math.round(who.competence)}.`,
      effects: [],
      decision: {
        authority: "players",
        prompt: `${who.name} has an offer of ${offer} cp/day from ${rival}. What do we do?`,
        standingOrder: "raiseRequest",
        defaultOptionId: "partial",
        respondWithinDays: 5,
        options: [
          {
            id: "grant",
            label: `Match it (${offer} cp/day)`,
            description: "Keep them, at a price.",
            effects: [
              { kind: "plan", patch: { staff: ctx.plan.staff.map((s) => (s.candidateId === who.id ? { ...s, wageCpPerDay: offer } : s)) }, note: `Matched ${rival}'s offer to ${who.name}` },
              { kind: "staff", staffId: who.id, loyaltyDelta: 10, moraleDelta: 10 },
            ],
          },
          {
            id: "partial",
            label: "Appeal to their loyalty",
            description: "Free — if they feel they belong here.",
            effects: loyal
              ? [{ kind: "staff", staffId: who.id, loyaltyDelta: 5, moraleDelta: -3 }, { kind: "reveal", topic: "staff", text: `${who.name} turned down ${rival}'s offer.` }]
              : [{ kind: "plan", patch: { staff: without }, note: `${who.name} left for ${rival}` }, { kind: "adjust", variable: "rivalHostility", delta: -5 }, { kind: "reveal", topic: "staff", text: `${who.name} took ${rival}'s offer.` }],
          },
          {
            id: "refuse",
            label: "Let them go",
            description: "Wish them well and hire someone else.",
            effects: [{ kind: "plan", patch: { staff: without }, note: `${who.name} left for ${rival}` }, { kind: "reveal", topic: "staff", text: `${who.name} left to work for ${rival}.` }],
          },
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

function upcomingFestival(ctx: EventContext, fromDays: number, toDays: number) {
  for (let d = ctx.date.absoluteDay + fromDays; d <= ctx.date.absoluteDay + toDays; d++) {
    const date = dateFromDay(ctx.world.calendar, d);
    for (const f of date.festivals) {
      const starts = f.month === null || date.dayOfMonth === f.day;
      const lift = f.demandMultiplier[ctx.neighborhood.id] ?? f.demandMultiplier["*"] ?? 1;
      if (starts && lift >= 1.25) return { festival: f, day: d, lift };
    }
  }
  return null;
}

const festivalPitchOffer: ConditionalEventDef = {
  id: "festival-pitch-offer",
  title: "A prime pitch for the festival",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 21,
  pacing: "decision",
  hazard(ctx) {
    const next = upcomingFestival(ctx, 6, 20);
    if (!next) return { probability: 0, drivers: [] };
    return { probability: 0.55, drivers: [{ label: `${next.festival.name} in ${next.day - ctx.date.absoluteDay} days`, value: 0.55 }] };
  },
  resolve(ctx) {
    const next = upcomingFestival(ctx, 6, 20)!;
    const fee = Math.max(100, Math.round((ctx.neighborhood.stallFeeCpPerWeek * 1.5) / 10) * 10);
    const inDays = next.day - ctx.date.absoluteDay;
    return {
      severity: "notable",
      playerText: `The ${next.festival.name} stewards offer us a prime pitch for the festival for ${formatCp(fee)}.`,
      dmText: `Pitch adds demand ×1.35 for ${next.festival.durationDays} festival day(s) and visibility. Worth it if production can keep up (consider the festival-day output multiplier).`,
      effects: [],
      decision: {
        authority: "players",
        prompt: `Pay ${formatCp(fee)} for a prime pitch at the ${next.festival.name}?`,
        standingOrder: "festivalPitch",
        defaultOptionId: "accept",
        respondWithinDays: Math.min(5, inDays - 1),
        options: [
          {
            id: "accept",
            label: `Take the pitch (${formatCp(fee)})`,
            description: "Bigger crowds on festival days — if we bake enough.",
            effects: [
              { kind: "cash", amountCp: -fee, category: "stallFees", note: `${next.festival.name} pitch` },
              { kind: "schedule", eventId: "festival-pitch", inDays: Math.max(1, inDays - Math.min(5, inDays - 1)), data: { name: next.festival.name, days: next.festival.durationDays } },
            ],
          },
          { id: "decline", label: "Decline", description: "Trade from our usual spot.", effects: [] },
        ],
      },
    };
  },
};

export const festivalPitch: ScheduledEventDef = {
  id: "festival-pitch",
  title: "Festival pitch",
  category: "opportunity",
  provenance: P,
  resolve(_ctx, _rng, data) {
    const days = Number(data.days) || 1;
    return {
      severity: "minor",
      playerText: `Our pitch at the ${String(data.name)} is drawing a crowd.`,
      dmText: `Demand ×1.35 for ${days} day(s); visibility +4.`,
      effects: [
        { kind: "modifier", id: "festival-pitch", label: `${String(data.name)} prime pitch`, target: "demand", multiplier: 1.35, durationDays: days },
        { kind: "adjust", variable: "visibility", delta: 4 },
      ],
    };
  },
};

// ---------------------------------------------------------------------------

const supplierExclusive: ConditionalEventDef = {
  id: "supplier-exclusive-offer",
  title: "An exclusive supply deal",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 140,
  pacing: "decision",
  hazard(ctx) {
    const ok = ctx.plan.suppliers >= 2 && weeksOpen(ctx) >= 4;
    return { probability: ok ? 0.04 : 0, drivers: ok ? [{ label: "Suppliers compete for a steady customer", value: 0.04 }] : [] };
  },
  resolve() {
    return {
      severity: "notable",
      playerText: "A butcher offers ingredients 10% cheaper for three months — if we buy from nobody else.",
      dmText: "Dilemma: cheaper ingredients vs. supply resilience (single supplier → more shortages).",
      effects: [],
      decision: {
        authority: "players",
        prompt: "Take an exclusive deal: 10% cheaper ingredients for 12 weeks, but only one supplier?",
        standingOrder: "supplierExclusive",
        defaultOptionId: "decline",
        respondWithinDays: 7,
        options: [
          {
            id: "accept",
            label: "Accept the exclusive deal",
            description: "Cheaper, but one late cart means no pies.",
            effects: [
              { kind: "plan", patch: { suppliers: 1 }, note: "Exclusive supplier deal" },
              { kind: "modifier", id: "exclusive-discount", label: "Exclusive supplier discount", target: "ingredientCost", multiplier: 0.9, durationDays: 84 },
            ],
          },
          { id: "decline", label: "Keep several suppliers", description: "Pay a little more for reliability.", effects: [] },
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

const rivalTruce: ConditionalEventDef = {
  id: "rival-truce-offer",
  title: "A rival proposes a truce",
  category: "emergent",
  provenance: P,
  phase: "weekly",
  cooldownDays: 84,
  pacing: "decision",
  hazard(ctx) {
    const h = ctx.state.business.hidden;
    const t = ctx.state.threads["rival-response"];
    const fair = fairPrice(ctx.world, ctx.neighborhood, ctx.plan.quality);
    const undercutting = ctx.plan.priceCp < fair * 0.95;
    const ok = h.rivalHostility >= 30 && (t?.stage ?? 0) <= 2 && undercutting;
    return { probability: ok ? 0.2 : 0, drivers: ok ? [{ label: "Rival hostility with room to talk", value: 0.2 }] : [] };
  },
  resolve(ctx) {
    const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
    const fair = Math.round(fairPrice(ctx.world, ctx.neighborhood, ctx.plan.quality));
    return {
      severity: "notable",
      playerText: `${rival} send word: stop undercutting at ${ctx.plan.priceCp} cp, charge at least ${fair} cp like everyone else, and they'll stop making trouble.`,
      dmText: `Peaceful exit from the rival thread. Accepting raises price to ${fair} cp, cuts rival hostility and resets the thread.`,
      sessionHook: "The rival owner could make the offer in person over an ale.",
      effects: [],
      decision: {
        authority: "players",
        prompt: `Agree with ${rival} to charge at least ${fair} cp?`,
        standingOrder: "rivalTruce",
        defaultOptionId: "accept",
        respondWithinDays: 7,
        options: [
          {
            id: "accept",
            label: `Agree (price ${fair} cp)`,
            description: "Peace on the street, higher margins, fewer customers.",
            effects: [
              { kind: "plan", patch: { priceCp: Math.max(ctx.plan.priceCp, fair) }, note: `Price truce with ${rival}` },
              { kind: "adjust", variable: "rivalHostility", delta: -25 },
              { kind: "thread", threadId: "rival-response", setProgress: 0, setStage: 0 },
            ],
          },
          { id: "decline", label: "Refuse", description: "Keep our prices.", effects: [{ kind: "adjust", variable: "rivalHostility", delta: 5 }] },
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

const charityRequest: ConditionalEventDef = {
  id: "charity-request",
  title: "A request for charity",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 112,
  pacing: "decision",
  hazard(ctx) {
    const ok = ctx.state.business.hidden.reputation >= 42 && ctx.state.business.lastWeekProfitCp > 0 && weeksOpen(ctx) >= 3;
    return { probability: ok ? 0.05 : 0, drivers: ok ? [{ label: "A known, profitable business", value: 0.05 }] : [] };
  },
  resolve(ctx) {
    const cost = Math.round(150 * unitCostToday(ctx));
    return {
      severity: "notable",
      playerText: `A temple almoner asks whether we could spare 150 pies for the hungry this week (about ${formatCp(cost)} in ingredients).`,
      dmText: "Goodwill: reputation, loyalty, guild and visibility gains for a modest cost.",
      effects: [],
      decision: {
        authority: "players",
        prompt: `Donate 150 pies (about ${formatCp(cost)}) to the temple's poor?`,
        standingOrder: "charity",
        defaultOptionId: "accept",
        respondWithinDays: 7,
        options: [
          {
            id: "accept",
            label: "Donate",
            description: "Good for the city — and for our name.",
            effects: [
              { kind: "cash", amountCp: -cost, category: "otherCosts", note: "Charity pies" },
              { kind: "adjust", variable: "reputation", delta: 4 },
              { kind: "adjust", variable: "loyalty", delta: 3 },
              { kind: "adjust", variable: "visibility", delta: 3 },
              { kind: "adjust", variable: "guildRelation", delta: 2 },
            ],
          },
          { id: "decline", label: "Politely decline", description: "Not this time.", effects: [] },
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

const guildInvitation: ConditionalEventDef = {
  id: "guild-invitation",
  title: "An invitation from the Fellowship",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 140,
  pacing: "decision",
  hazard(ctx) {
    const h = ctx.state.business.hidden;
    const t = ctx.state.threads["guild-pressure"];
    const ok = ctx.plan.guild === "none" && h.reputation >= 55 && h.visibility >= 35 && (t?.stage ?? 0) <= 1;
    const p = ok ? 0.08 * clamp01(ctx.neighborhood.guildPresence + 0.3) : 0;
    return { probability: p, drivers: ok ? [{ label: "A well-regarded independent seller", value: p }] : [] };
  },
  resolve(ctx) {
    const a = ctx.world.assumptions.guild;
    return {
      severity: "notable",
      playerText: `${ctx.actorName("bakers-fellowship")} invite us to join the Merchants' Guild as associates — initiation fee waived.`,
      dmText: "A friendly path into the guild for a respected independent.",
      effects: [],
      decision: {
        authority: "players",
        prompt: "Accept the Fellowship's invitation to join the guild?",
        standingOrder: "guildNotice",
        defaultOptionId: "join-associate",
        respondWithinDays: 14,
        options: [
          {
            id: "join-associate",
            label: `Join as associate (fee waived, ${formatCp(a.associateDuesCpPerWeek)}/wk)`,
            description: "Goodwill and fewer problems later.",
            effects: [
              { kind: "plan", patch: { guild: "associate" }, note: "Joined the guild by invitation" },
              { kind: "adjust", variable: "guildRelation", delta: 12 },
              { kind: "thread", threadId: "guild-pressure", setProgress: 0, setStage: 0 },
            ],
          },
          {
            id: "join-member",
            label: `Join as full member (${formatCp(a.memberInitiationCp)}, ${formatCp(a.memberDuesCpPerWeek)}/wk)`,
            description: "Full standing.",
            effects: [
              { kind: "plan", patch: { guild: "member" }, note: "Joined the guild as a full member" },
              { kind: "cash", amountCp: -a.memberInitiationCp, category: "guildDues", note: "Guild member initiation" },
              { kind: "adjust", variable: "guildRelation", delta: 18 },
              { kind: "thread", threadId: "guild-pressure", setProgress: 0, setStage: 0 },
            ],
          },
          { id: "refuse", label: "Stay independent", description: "Decline with thanks.", effects: [{ kind: "adjust", variable: "guildRelation", delta: -3 }] },
        ],
      },
    };
  },
};

// ---------------------------------------------------------------------------

const caravanCommission: ConditionalEventDef = {
  id: "caravan-commission",
  title: "A commission with a catch",
  category: "opportunity",
  provenance: P,
  phase: "weekly",
  cooldownDays: 70,
  pacing: "decision",
  hazard(ctx) {
    const ok = ctx.state.business.hidden.reputation >= 42 && ctx.state.business.hidden.visibility >= 30 && weeksOpen(ctx) >= 4;
    return { probability: ok ? 0.03 : 0, drivers: ok ? [{ label: "Known for reliable baking", value: 0.03 }] : [] };
  },
  resolve(ctx, rng) {
    const qty = rng.int(25, 35) * 10;
    const price = Math.max(1, Math.round(fairPrice(ctx.world, ctx.neighborhood, ctx.plan.quality) * 1.4));
    const where = rng.pick(["the Outer Ward gate", "a camp beyond the walls", "the far side of the Shades"]);
    return {
      severity: "major",
      playerText: `A caravan master wants ${qty} pies delivered to ${where} at dawn in five days — ${formatCp(price)} each, well above the going rate. Carters say that road has had trouble lately.`,
      dmText: `Lucrative order with an adventure hook. Delivery uses spare construct capacity plus a diverted day of street stock; a party escort is the obvious session hook.`,
      sessionHook: `Escort the delivery to ${where} — who has been troubling that road?`,
      effects: [],
      decision: {
        authority: "players",
        prompt: `Take the caravan order: ${qty} pies at ${formatCp(price)} each, delivered to ${where}?`,
        standingOrder: "largeOrder",
        defaultOptionId: "accept",
        respondWithinDays: 2,
        options: [
          {
            id: "accept",
            label: `Accept (${formatCp(qty * price)})`,
            description: "Bake through the night and hold back a day's street stock.",
            effects: [{ kind: "schedule", eventId: "large-order-delivery", inDays: 3, data: { qty, priceCp: price, who: "the caravan master", lead: 5, divert: 1 } }],
          },
          {
            id: "escort",
            label: "Accept — and escort it ourselves",
            description: "The party rides with the delivery (play it at the table).",
            effects: [
              { kind: "schedule", eventId: "large-order-delivery", inDays: 3, data: { qty, priceCp: price, who: "the caravan master", lead: 5, divert: 1 } },
              { kind: "addCondition", id: "awaiting-session:caravan", label: `Escort the caravan delivery to ${where}`, durationDays: 7, visibleToPlayers: true },
            ],
          },
          { id: "decline", label: "Decline", description: "Not worth the risk.", effects: [] },
        ],
      },
    };
  },
};

export const opportunityEvents: ConditionalEventDef[] = [raiseRequest, staffPoached, festivalPitchOffer, supplierExclusive, rivalTruce, charityRequest, guildInvitation, caravanCommission];
