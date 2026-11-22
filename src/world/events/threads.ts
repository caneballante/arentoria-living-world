/**
 * Developing situations ("threads"): progress clocks driven by world conditions.
 * Each stage gives players a warning sign before things get serious, and pressure
 * can fall again (stages recede) when the underlying conditions improve.
 *
 * Thresholds: stage 1 at 4, stage 2 at 9, stage 3 at 14, stage 4 at 20 (provisional).
 * Pressure values are weekly rates. Actors are PROPOSED local groups unless noted.
 */
import { proposed } from "../../engine/provenance";
import type { DecisionOption, Driver, Effect, EventContext, ThreadDef } from "../../engine/types";
import { avgWeeklyRevenue, formatCp, vendors } from "./helpers";

const P = proposed("Thread content is proposed; thresholds and pressures are provisional.");

const flagOption = (threadId: string, days: number): DecisionOption => ({
  id: "flag",
  label: "Handle it in person (flag for the next session)",
  description: "Freeze this situation until the DM resolves it at the table.",
  effects: [
    { kind: "thread", threadId, freezeDays: days },
    { kind: "addCondition", id: `awaiting-session:${threadId}`, label: "Awaiting in-person resolution", durationDays: days, visibleToPlayers: true },
  ],
});

const moraleHit = (ctx: EventContext, delta: number): Effect[] => vendors(ctx).map((s) => ({ kind: "staff", staffId: s.id, moraleDelta: delta }));

// ---------------------------------------------------------------------------
// Extortion by a local crew
// ---------------------------------------------------------------------------

function protectionFee(ctx: EventContext, factor = 1): number {
  return Math.max(100, Math.round((avgWeeklyRevenue(ctx) * 0.1 * factor) / 10) * 10);
}

export const extortion: ThreadDef = {
  id: "extortion",
  title: "Protection racket",
  provenance: P,
  actorId: (ctx) => ctx.neighborhood.crewActorId,
  maxProgress: 24,
  hysteresis: 2,
  minDwellDays: 10,
  pressure(ctx) {
    const ca = ctx.state.business.hidden.criminalAttention;
    const drivers: Driver[] = [{ label: "Criminal attention above tolerance (25)", value: (ca - 25) * 0.12 }];
    if (ctx.hasCondition("paying-protection")) drivers.push({ label: "Paying protection", value: -2 });
    return drivers;
  },
  stages: [
    {
      stage: 1,
      title: "Watchers",
      threshold: 4,
      onEnter(ctx) {
        const crew = ctx.actorName(ctx.neighborhood.crewActorId);
        return {
          severity: "minor",
          playerText: "The same two strangers have walked past the outlet several times this week, counting customers.",
          dmText: `${crew} are sizing the business up (criminal attention ${Math.round(ctx.state.business.hidden.criminalAttention)}).`,
          effects: [],
        };
      },
    },
    {
      stage: 2,
      title: "The proposition",
      threshold: 9,
      repeatCooldownDays: 28,
      onEnter(ctx) {
        const crew = ctx.actorName(ctx.neighborhood.crewActorId);
        const already = ctx.hasCondition("paying-protection");
        const fee = protectionFee(ctx, already ? 1.4 : 1);
        const pay = (f: number, ca: number, progress: number, stage: number): Effect[] => [
          { kind: "addCondition", id: "paying-protection", label: `Paying ${crew}`, data: { feeCp: f, crew }, visibleToPlayers: true },
          { kind: "adjust", variable: "criminalAttention", delta: ca },
          { kind: "thread", threadId: "extortion", setProgress: progress, setStage: stage },
        ];
        return {
          severity: "notable",
          playerText: already
            ? `A collector from ${crew} explains that "protection costs have gone up": ${formatCp(fee)} a week now.`
            : `A friendly man from ${crew} explains that the street can be dangerous, and that ${formatCp(fee)} a week would keep the outlet safe.`,
          dmText: `${crew} demand ${formatCp(fee)}/week. Refusing keeps pressure building toward a warning.`,
          sessionHook: "The collector is a good NPC to roleplay; players might negotiate, follow him, or push back.",
          effects: [],
          decision: {
            authority: "players",
            prompt: `${crew} want ${formatCp(fee)} a week for "protection". How do we answer?`,
            standingOrder: "protectionDemand",
            defaultOptionId: "refuse",
            // "We'll be back on market day for your answer."
            respondWithinDays: 3,
            options: [
              { id: "pay", label: `Pay ${formatCp(fee)} a week`, description: "Buy peace. It may not stay this price.", effects: pay(fee, -25, 2, 0) },
              {
                id: "negotiate",
                label: `Haggle down to ~${formatCp(Math.round(fee * 0.6))}`,
                description: "Pay less; they'll be back sooner.",
                effects: pay(Math.max(60, Math.round((fee * 0.6) / 10) * 10), -15, 6, 1),
              },
              {
                id: "refuse",
                label: "Refuse",
                description: "Say no. Staff will be nervous.",
                effects: [{ kind: "adjust", variable: "criminalAttention", delta: 5 }, { kind: "thread", threadId: "extortion", progressDelta: 1 }, ...moraleHit(ctx, -5)],
              },
              flagOption("extortion", 21),
            ],
          },
        };
      },
    },
    {
      stage: 3,
      title: "A warning",
      threshold: 14,
      major: true,
      repeatCooldownDays: 28,
      onEnter(ctx, rng) {
        const crew = ctx.actorName(ctx.neighborhood.crewActorId);
        // Scaled to the business: a warning has to hurt whatever its size.
        const damage = Math.max(150, Math.round((avgWeeklyRevenue(ctx) * rng.range(0.25, 0.45)) / 10) * 10);
        return {
          severity: "major",
          playerText: `Overnight someone smashed up our gear and fouled the stock — about ${formatCp(damage)} of damage. Today's sales suffered and the staff are shaken.`,
          dmText: `${crew} deliver a warning after the business refused to pay.`,
          sessionHook: `An encounter with ${crew}'s enforcers, or a chance to catch them in the act.`,
          effects: [
            { kind: "cash", amountCp: -damage, category: "losses", note: "Vandalism" },
            { kind: "modifier", id: "vandalism", label: "Recovering from vandalism", target: "demand", multiplier: 0.3, durationDays: 1 },
            { kind: "adjust", variable: "reputation", delta: -2 },
            { kind: "adjust", variable: "visibility", delta: 3 },
            { kind: "adjust", variable: "scrutiny", delta: 2 },
            ...moraleHit(ctx, -15),
          ],
        };
      },
    },
    {
      stage: 4,
      title: "Reprisal",
      threshold: 20,
      major: true,
      repeatCooldownDays: 35,
      onEnter(ctx) {
        const crew = ctx.actorName(ctx.neighborhood.crewActorId);
        const fee = protectionFee(ctx, 1.5);
        const staff = vendors(ctx)[0];
        // Threats resolve rather than loop: the second refusal ends this round, one way or another.
        const defiance = Number(ctx.state.conditions.find((c) => c.id === "crew-defiance")?.data?.count ?? 0);
        const secured = ctx.plan.security.precautions || ctx.state.business.staff.some((s) => s.role === "guard");
        const refuse: DecisionOption =
          defiance === 0
            ? {
                id: "refuse",
                label: "Refuse again",
                description: "They will probably try once more.",
                effects: [
                  { kind: "addCondition", id: "crew-defiance", label: `Defied ${crew}`, data: { count: 1 }, durationDays: 365, visibleToPlayers: false },
                  { kind: "thread", threadId: "extortion", setProgress: 15, setStage: 3 },
                  ...moraleHit(ctx, -10),
                ],
              }
            : secured
              ? {
                  id: "refuse",
                  label: "Refuse — and make it stick",
                  description: "With our precautions and guard, they may decide we're not worth the trouble.",
                  effects: [
                    { kind: "thread", threadId: "extortion", setProgress: 0, setStage: 0, freezeDays: 84 },
                    { kind: "removeCondition", id: "crew-defiance" },
                    { kind: "adjust", variable: "criminalAttention", delta: -35 },
                    { kind: "adjust", variable: "reputation", delta: 2 },
                    { kind: "addCondition", id: "stood-up-to-crew", label: `Stood up to ${crew}`, durationDays: 84, visibleToPlayers: true },
                    { kind: "reveal", topic: "street", text: `Word is ${crew} have decided we're more trouble than we're worth.` },
                  ],
                }
              : {
                  id: "refuse",
                  label: "Refuse — this gets settled in person",
                  description: "Without real security they'll hit us hard first; the showdown happens at the table.",
                  effects: [
                    { kind: "cash", amountCp: -Math.max(400, Math.round(avgWeeklyRevenue(ctx) / 10) * 10), category: "losses", note: "Smashed stock and stolen takings" },
                    { kind: "modifier", id: "crew-intimidation", label: "Customers avoiding trouble", target: "demand", multiplier: 0.7, durationDays: 28 },
                    ...(staff ? [{ kind: "plan" as const, patch: { staff: ctx.plan.staff.filter((s) => s.candidateId !== staff.id) }, note: `${staff.name} quit after the attack` }] : []),
                    { kind: "adjust", variable: "reputation", delta: -3 },
                    ...moraleHit(ctx, -15),
                    { kind: "thread", threadId: "extortion", freezeDays: 56 },
                    { kind: "removeCondition", id: "crew-defiance" },
                    { kind: "adjust", variable: "criminalAttention", delta: -10 },
                    { kind: "addCondition", id: "awaiting-session:extortion", label: `Showdown with ${crew} awaits in-person play`, durationDays: 56, visibleToPlayers: true },
                  ],
                };
        return {
          severity: "major",
          playerText: `${staff ? staff.name : "Our seller"} was cornered and roughed up on the way home. ${crew} say the price is now ${formatCp(fee)} a week.`,
          dmText: `${crew} escalate to violence against staff.`,
          sessionHook: `A direct confrontation with ${crew} — this is adventure material.`,
          effects: [...moraleHit(ctx, -25), { kind: "adjust", variable: "reputation", delta: -3 }],
          decision: {
            authority: "players",
            prompt: `${crew} have hurt one of our people and demand ${formatCp(fee)} a week. What now?`,
            standingOrder: "protectionDemand",
            defaultOptionId: "pay",
            options: [
              {
                id: "pay",
                label: `Pay ${formatCp(fee)} a week`,
                description: "End it, for now.",
                effects: [
                  { kind: "addCondition", id: "paying-protection", label: `Paying ${crew}`, data: { feeCp: fee, crew }, visibleToPlayers: true },
                  { kind: "adjust", variable: "criminalAttention", delta: -30 },
                  { kind: "thread", threadId: "extortion", setProgress: 2, setStage: 0 },
                ],
              },
              refuse,
              flagOption("extortion", 28),
            ],
          },
        };
      },
    },
  ],
  recede(ctx, from) {
    const crew = ctx.actorName(ctx.neighborhood.crewActorId);
    return {
      severity: "minor",
      playerText: from === 1 ? "The strangers who were watching the outlet haven't been seen for a while." : "Things have been quieter on the street lately.",
      dmText: `${crew} lose interest (stage ${from} → ${from - 1}).`,
      effects: [],
    };
  },
};

// ---------------------------------------------------------------------------
// Trade-fellowship (Merchants' Guild) pressure
// ---------------------------------------------------------------------------

export const guildPressure: ThreadDef = {
  id: "guild-pressure",
  title: "Fellowship pressure",
  provenance: P,
  actorId: () => "bakers-fellowship",
  maxProgress: 24,
  hysteresis: 2,
  minDwellDays: 10,
  pressure(ctx) {
    const h = ctx.state.business.hidden;
    const nonMember = { none: 1, associate: 0.2, member: 0 }[ctx.plan.guild];
    return [
      { label: "Visible trading outside the Fellowship", value: 5 * nonMember * ctx.neighborhood.guildPresence * (h.visibility / 100) },
      { label: "Poor standing with the guild", value: (45 - h.guildRelation) * 0.06 },
      { label: "Too small to bother with", value: -1 },
    ];
  },
  stages: [
    {
      stage: 1,
      title: "A courtesy call",
      threshold: 4,
      onEnter(ctx) {
        return {
          severity: "minor",
          playerText: `A representative of ${ctx.actorName("bakers-fellowship")} stopped by, admired the pies, and asked whether we had registered with the Fellowship.`,
          dmText: "The Fellowship (affiliated with the Merchants' Guild) has noticed an unregistered seller.",
          effects: [{ kind: "reveal", topic: "guild", text: "The Bakers' and Piemakers' Fellowship has asked whether we are registered." }],
        };
      },
    },
    {
      stage: 2,
      title: "Formal notice",
      threshold: 9,
      onEnter(ctx) {
        const a = ctx.world.assumptions.guild;
        const join = (level: "associate" | "member", cost: number, rel: number): Effect[] => [
          { kind: "plan", patch: { guild: level }, note: `Joined the Merchants' Guild as ${level}` },
          { kind: "cash", amountCp: -cost, category: "guildDues", note: `Guild ${level} initiation` },
          { kind: "adjust", variable: "guildRelation", delta: rel },
          { kind: "thread", threadId: "guild-pressure", setProgress: 0, setStage: 0 },
        ];
        return {
          severity: "notable",
          playerText: "A sealed notice from the Fellowship: sellers of baked goods in the city are 'expected' to join the Merchants' Guild.",
          dmText: "Formal pressure to join. Refusing leads to supplier obstruction, then a formal complaint.",
          effects: [],
          decision: {
            authority: "players",
            prompt: "The Fellowship expects us to join the Merchants' Guild. Our answer?",
            standingOrder: "guildNotice",
            defaultOptionId: "refuse",
            respondWithinDays: 14,
            options: [
              { id: "join-associate", label: `Join as associate (${formatCp(a.associateInitiationCp)} + ${formatCp(a.associateDuesCpPerWeek)}/wk)`, description: "Minimum standing; most pressure stops.", effects: join("associate", a.associateInitiationCp, 10) },
              { id: "join-member", label: `Join as full member (${formatCp(a.memberInitiationCp)} + ${formatCp(a.memberDuesCpPerWeek)}/wk)`, description: "Full standing, connections and protection from rivals.", effects: join("member", a.memberInitiationCp, 18) },
              { id: "refuse", label: "Decline", description: "Stay independent.", effects: [{ kind: "adjust", variable: "guildRelation", delta: -8 }, { kind: "thread", threadId: "guild-pressure", progressDelta: 1 }] },
              flagOption("guild-pressure", 21),
            ],
          },
        };
      },
    },
    {
      stage: 3,
      title: "The cold shoulder",
      threshold: 14,
      repeatCooldownDays: 56,
      onEnter() {
        return {
          severity: "notable",
          playerText: "Two of our suppliers have suddenly found themselves 'fully committed', and prices from the rest have crept up.",
          dmText: "Fellowship obstruction: supply-shortage risk ×2.5 and ingredient cost ×1.12 for six weeks.",
          effects: [
            { kind: "addCondition", id: "guild-obstruction", label: "Suppliers obstructed by the Fellowship", durationDays: 42, visibleToPlayers: false },
            { kind: "modifier", id: "guild-obstruction-cost", label: "Fellowship-influenced supplier prices", target: "ingredientCost", multiplier: 1.12, durationDays: 42 },
            { kind: "adjust", variable: "guildRelation", delta: -5 },
          ],
        };
      },
    },
    {
      stage: 4,
      title: "A formal complaint",
      threshold: 20,
      major: true,
      repeatCooldownDays: 84,
      onEnter(ctx, rng) {
        // Where the guild is strong, its complaint can get a non-member's permit suspended pending a hearing.
        const suspendDays = ctx.plan.guild === "none" && ctx.neighborhood.guildPresence >= 0.6 ? rng.int(7, 14) : 0;
        return {
          severity: "major",
          playerText: `The Fellowship has lodged a formal complaint with the city about our 'irregular trading'.${suspendDays ? ` Our permit is suspended for ${suspendDays} days pending a hearing.` : " Expect officials."}`,
          dmText: `Complaint: scrutiny +20 and the inspection thread advances${suspendDays ? `; permit suspended ${suspendDays} days (guild presence ${ctx.neighborhood.guildPresence})` : ""}.`,
          sessionHook: "A hearing with a guild magistrate or Council clerk; Galen Vale could represent the party.",
          effects: [
            { kind: "adjust", variable: "scrutiny", delta: 20 },
            { kind: "thread", threadId: "inspection", progressDelta: 6 },
            { kind: "adjust", variable: "guildRelation", delta: -5 },
            ...(suspendDays ? [{ kind: "suspend" as const, days: suspendDays, reason: "Permit suspended after a guild complaint" }] : []),
          ],
        };
      },
    },
  ],
  recede() {
    return { severity: "minor", playerText: "The Fellowship seems to have turned its attention elsewhere.", dmText: "Guild pressure easing.", effects: [] };
  },
};

// ---------------------------------------------------------------------------
// Official scrutiny → inspection
// ---------------------------------------------------------------------------

export const inspection: ThreadDef = {
  id: "inspection",
  title: "Official scrutiny",
  provenance: P,
  actorId: () => "licensing-office",
  maxProgress: 14,
  hysteresis: 2,
  minDwellDays: 10,
  pressure(ctx) {
    return [{ label: "Official scrutiny above routine (20)", value: (ctx.state.business.hidden.scrutiny - 20) * 0.12 }];
  },
  stages: [
    {
      stage: 1,
      title: "Questions asked",
      threshold: 4,
      repeatCooldownDays: 28,
      onEnter() {
        return {
          severity: "minor",
          playerText: "A clerk from the licensing office asked our staff who holds the permit and wrote something down.",
          dmText: "Scrutiny is building toward an inspection.",
          effects: [{ kind: "reveal", topic: "legal", text: "A licensing clerk has been asking about our permits." }],
        };
      },
    },
    {
      stage: 2,
      title: "Inspection",
      threshold: 9,
      major: true,
      repeatCooldownDays: 42,
      onEnter(ctx) {
        const plan = ctx.plan;
        const licensed = ctx.state.business.licensing.status === "approved";
        const violations: { text: string; fine: number; suspendDays: number; order?: Effect }[] = [];
        if (plan.compliance === "informal")
          violations.push({
            text: "trading without a vendor permit",
            fine: 300,
            suspendDays: ctx.neighborhood.enforcement >= 0.6 ? 3 : 0,
            order: { kind: "plan", patch: { compliance: "basic" }, note: "Ordered to buy a vendor permit" },
          });
        if (plan.compliance !== "full" && ctx.hasCondition("recent-complaint")) violations.push({ text: "no food-safety certificate after a complaint", fine: 150, suspendDays: 0 });
        if (plan.constructPublicity === "showcased" && !licensed)
          violations.push({
            text: "unlicensed constructs in commercial use",
            fine: 500,
            suspendDays: 7,
            order: { kind: "plan", patch: { constructPublicity: "discreet" }, note: "Ordered to keep unlicensed constructs out of public view" },
          });
        if (!violations.length) {
          return {
            severity: "notable",
            playerText: "An inspector from the licensing office checked our permits and kitchen practices and left satisfied.",
            dmText: "Inspection passed: scrutiny −15.",
            effects: [
              { kind: "adjust", variable: "scrutiny", delta: -15 },
              { kind: "adjust", variable: "guildRelation", delta: 2 },
              { kind: "thread", threadId: "inspection", setProgress: 0, setStage: 0 },
            ],
          };
        }
        // Repeat offenders pay more: each prior penalty this year doubles, triples… the standard penalty.
        const priors = Number(ctx.state.conditions.find((c) => c.id === "inspection-record")?.data?.count ?? 0);
        const fine = violations.reduce((a, v) => a + v.fine, 0) * (1 + priors);
        const suspend = Math.max(...violations.map((v) => v.suspendDays)) * (1 + priors) + (priors >= 2 ? 7 : 0);
        const record: Effect = { kind: "addCondition", id: "inspection-record", label: "Prior inspection penalties", data: { count: priors + 1 }, durationDays: 365, visibleToPlayers: true };
        const orders = violations.flatMap((v) => (v.order ? [v.order] : []));
        const found = violations.map((v) => v.text).join("; ");
        return {
          severity: "major",
          playerText: `Inspectors from the licensing office found problems: ${found}.`,
          dmText: `Inspection failed (${violations.length} violation(s)${priors ? `, ${priors} prior penalt${priors === 1 ? "y" : "ies"} this year` : ""}). Standard penalty: ${formatCp(fine)} fine${suspend ? `, ${suspend}-day suspension` : ""}${orders.length ? ", correction orders" : ""}. The DM rules on the outcome.`,
          sessionHook: "Galen Vale could contest the findings; an inspector might be persuadable (or bribable).",
          effects: [{ kind: "adjust", variable: "reputation", delta: -3 }],
          decision: {
            authority: "dm",
            prompt: `Inspectors found: ${found}. How does the licensing office rule?`,
            dmAssumption: "inspectionRulings",
            defaultOptionId: "uphold",
            options: [
              {
                id: "uphold",
                label: `Full penalty: ${formatCp(fine)}${suspend ? ` and ${suspend} days' suspension` : ""}`,
                description: "The office applies its standard penalties and correction orders.",
                effects: [
                  { kind: "cash", amountCp: -fine, category: "fines", note: "Inspection fine" },
                  ...(suspend ? [{ kind: "suspend" as const, days: suspend, reason: "Failed inspection" }] : []),
                  ...orders,
                  { kind: "reveal", topic: "legal", text: `Fined ${formatCp(fine)}${suspend ? ` and suspended for ${suspend} days` : ""} after an inspection${priors ? " — penalties are rising for repeat offences" : ""}.` },
                  record,
                  { kind: "adjust", variable: "scrutiny", delta: -8 },
                  { kind: "thread", threadId: "inspection", setProgress: 3, setStage: 0 },
                ],
              },
              {
                id: "lenient",
                label: `Warning and half fine (${formatCp(Math.round(fine / 2))})`,
                description: "A first offence; correction orders still apply.",
                effects: [
                  { kind: "cash", amountCp: -Math.round(fine / 2), category: "fines", note: "Inspection fine (reduced)" },
                  ...orders,
                  { kind: "reveal", topic: "legal", text: `Let off with a warning and a reduced fine after an inspection.` },
                  { kind: "adjust", variable: "scrutiny", delta: -4 },
                  { kind: "thread", threadId: "inspection", setProgress: 4, setStage: 0 },
                ],
              },
              flagOption("inspection", 21),
            ],
          },
        };
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Rival business response
// ---------------------------------------------------------------------------

export const rivalResponse: ThreadDef = {
  id: "rival-response",
  title: "Rival response",
  provenance: P,
  actorId: (ctx) => ctx.neighborhood.rivalActorId,
  maxProgress: 24,
  hysteresis: 2,
  minDwellDays: 10,
  pressure(ctx) {
    return [{ label: "Rival hostility above tolerance (25)", value: (ctx.state.business.hidden.rivalHostility - 25) * 0.12 }];
  },
  stages: [
    {
      stage: 1,
      title: "Noticed",
      threshold: 4,
      onEnter(ctx) {
        const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
        return {
          severity: "minor",
          playerText: `An apprentice from ${rival} bought three of our pies and left without eating them.`,
          dmText: `${rival} are studying the competition.`,
          effects: [],
        };
      },
    },
    {
      stage: 2,
      title: "Price war",
      threshold: 9,
      repeatCooldownDays: 56,
      onEnter(ctx) {
        const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
        return {
          severity: "notable",
          playerText: `${rival} cut their prices and have a boy shouting about it outside our pitch.`,
          dmText: "Competition ×1.35 for four weeks.",
          effects: [{ kind: "modifier", id: "price-war", label: `${rival} price war`, target: "competition", multiplier: 1.35, durationDays: 28 }],
        };
      },
    },
    {
      stage: 3,
      title: "Whispers",
      threshold: 14,
      repeatCooldownDays: 70,
      onEnter(ctx) {
        const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
        return {
          severity: "notable",
          playerText: "People are whispering that our 'magic cooks' use alley-cat meat. Someone started that story.",
          dmText: `${rival} are spreading rumors: reputation −7, scrutiny +3.`,
          sessionHook: "Players could trace the rumor to its source.",
          effects: [
            { kind: "adjust", variable: "reputation", delta: -7 },
            { kind: "adjust", variable: "scrutiny", delta: 3 },
          ],
        };
      },
    },
    {
      stage: 4,
      title: "Dirty tricks",
      threshold: 20,
      major: true,
      repeatCooldownDays: 120,
      onEnter(ctx) {
        const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
        const member = ctx.plan.guild !== "none";
        const feud = Number(ctx.state.conditions.find((c) => c.id === "rival-feud")?.data?.count ?? 0);
        const weather: DecisionOption =
          feud === 0
            ? {
                id: "ignore",
                label: "Weather it",
                description: "Absorb the losses; tempers may cool.",
                effects: [
                  { kind: "addCondition", id: "rival-feud", label: `Feud with ${rival}`, data: { count: 1 }, durationDays: 365, visibleToPlayers: false },
                  { kind: "thread", threadId: "rival-response", setProgress: 6, setStage: 1 },
                ],
              }
            : {
                id: "ignore",
                label: "Weather it again",
                description: "Feuds burn out when one side refuses to play.",
                effects: [
                  { kind: "thread", threadId: "rival-response", setProgress: 0, setStage: 0, freezeDays: 112 },
                  { kind: "removeCondition", id: "rival-feud" },
                  { kind: "adjust", variable: "rivalHostility", delta: -25 },
                  { kind: "addCondition", id: "feud-cooled", label: `Uneasy peace with ${rival}`, durationDays: 112, visibleToPlayers: true },
                  { kind: "reveal", topic: "street", text: `The feud with ${rival} seems to have burned itself out.` },
                ],
              };
        return {
          severity: "major",
          playerText: "Someone salted our flour and cut the cart's wheel strap. It wasn't an accident.",
          dmText: `${rival} resort to sabotage.`,
          sessionHook: `Catch ${rival}'s saboteur in the act?`,
          effects: [
            { kind: "cash", amountCp: -Math.max(200, Math.round((avgWeeklyRevenue(ctx) * 0.5) / 10) * 10), category: "losses", note: "Sabotage" },
            { kind: "adjust", variable: "reputation", delta: -3 },
            { kind: "adjust", variable: "rivalHostility", delta: -10 },
          ],
          decision: {
            authority: "players",
            prompt: `${rival} are sabotaging us. How do we respond?`,
            standingOrder: "rivalTricks",
            defaultOptionId: "ignore",
            respondWithinDays: 7,
            options: [
              weather,
              {
                id: "seek-mediation",
                label: member ? "Ask the Fellowship to mediate" : "Ask the Fellowship to mediate (we are not members)",
                description: member ? "Members settle disputes through the Fellowship." : "They are unlikely to help non-members.",
                effects: member
                  ? [{ kind: "cash", amountCp: -100, category: "guildDues", note: "Mediation fee" }, { kind: "thread", threadId: "rival-response", setProgress: 5, setStage: 1 }, { kind: "adjust", variable: "rivalHostility", delta: -20 }]
                  : [{ kind: "thread", threadId: "rival-response", setProgress: 8, setStage: 1 }, { kind: "adjust", variable: "guildRelation", delta: -2 }],
              },
              flagOption("rival-response", 28),
            ],
          },
        };
      },
    },
  ],
  recede(ctx) {
    const rival = ctx.actorName(ctx.neighborhood.rivalActorId);
    return { severity: "minor", playerText: `${rival} seem to have stopped worrying about us.`, dmText: "Rival hostility easing.", effects: [] };
  },
};

export const threads: ThreadDef[] = [extortion, guildPressure, inspection, rivalResponse];
