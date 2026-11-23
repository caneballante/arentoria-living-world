/**
 * The simulation runner.
 *
 * Time advances one day at a time. Each day:
 *   1. weather and ingredient markets move
 *   2. expired modifiers/conditions lapse; suspensions end
 *   3. scheduled events due today fire
 *   4. developing threads (progress clocks) accumulate pressure and may change stage
 *   5. morning events (absences, shortages, crowds) fire
 *   6. the business operates (production, sales, daily costs)
 *   7. evening events (theft, complaints) fire
 *   8. on the last day of each 7-day accounting week: fixed costs, hidden-state
 *      dynamics, staff, wholesale accounts, weekly events, owner draws, week record
 *
 * Every decision has a due day: urgent ones are due the day they arise; others can
 * wait (a response window). At the end of its due day a decision is resolved — with a
 * supplied answer (which may have been given early), by pausing for a human, or
 * automatically from the plan's standing orders / sandbox assumptions. Because
 * resolution always happens at the end of the due day, an interactive run and an
 * unattended run that make the same choices produce identical results.
 *
 * Interventions (DM corrections, approved freeform actions, plan revisions) can be
 * scheduled for a given day; they are applied at the start of that day.
 */

import { dateFromDay, type CalendarDate } from "./calendar";
import { computeDerived, updateHidden, updateStaff, updateWholesaleAccounts, weekStats } from "./dynamics";
import { dailyConstructCapacity, emptyLedger, hasActiveCondition, ledgerCosts, ledgerIncome, runOperations, weeklyFixedCosts } from "./economy";
import { stageViolations } from "./stage";
export { stageViolations } from "./stage";
import { applyChange, applyEffect, hireStaff, nextId } from "./effects";
import { clamp, clamp01, formatCp, round } from "./math";
import { parsePlan, type BusinessPlan, type BusinessPlanInput } from "./plan";
import { rngFor, uniformFor } from "./rng";
import type {
  AppliedChange,
  Authority,
  DerivedMetrics,
  Driver,
  Effect,
  EventContext,
  EventOutcome,
  EventRecord,
  NeighborhoodDef,
  PendingDecision,
  SandboxAssumptions,
  WeekAccumulator,
  WeekRecord,
  WorldDefinition,
  WorldState,
} from "./types";
import { initialWeather, nextMarket, nextWeather } from "./weather";
import { accountStatusOf, accountSummary } from "./account";

export type PauseMode = "never" | "decisions" | "decisions-and-major";

export interface ScheduledIntervention {
  /** Absolute day; applied at the start of that day. */
  day: number;
  authority: Extract<Authority, "dm" | "players">;
  description: string;
  effects: Effect[];
  refId?: string;
}

export interface RunOptions {
  /** Stop after simulating this absolute day (inclusive). */
  untilDay?: number;
  /** Alternatively: simulate this many more weeks from the current day. */
  weeks?: number;
  pause?: PauseMode;
  /** Answers to decisions, keyed by decision id (deterministic ids). Applied at each decision's due day. */
  resolutions?: Record<string, string>;
  /** Major events already acknowledged (event record ids) — no pause for these. */
  acknowledged?: string[];
  /** Interventions to apply at the start of given days (e.g. plan revisions between sessions). */
  interventions?: ScheduledIntervention[];
  /**
   * "Advance until something needs the party": stop at the end of any day after this
   * absolute day on which a decision arose or a major event happened.
   */
  stopWhenNeededAfterDay?: number;
}

export interface RunResult {
  state: WorldState;
  status: "completed" | "paused";
  /** All open decisions, including ones that can still wait. */
  pending: PendingDecision[];
  /** Ids of decisions due now that stopped the clock. */
  blocking: string[];
  /** When paused for a major event without a decision. */
  pausedOnEvent?: EventRecord;
}

export interface InitOptions {
  seed: string;
  startDay: number;
  sandbox?: Partial<SandboxAssumptions>;
  /** Override the licensing decision day (absolute day). */
  licensingDecisionDay?: number;
}

export const LICENSING_EVENT_ID = "construct-license-decision";

// ---------------------------------------------------------------------------
// Plan validation against the world
// ---------------------------------------------------------------------------

export interface PlanCheck {
  errors: string[];
  warnings: string[];
}

export function checkPlan(world: WorldDefinition, plan: BusinessPlan): PlanCheck {
  const errors: string[] = [...stageViolations(world, plan)];
  const warnings: string[] = [];
  if (!world.neighborhoods[plan.neighborhood]) errors.push(`Unknown neighborhood "${plan.neighborhood}"`);
  if (!world.assumptions.qualityTiers.some((t) => t.tier === plan.quality)) errors.push(`Unknown quality tier ${plan.quality}`);
  for (const s of plan.staff) {
    const c = world.staffPool.find((x) => x.id === s.candidateId);
    if (!c) errors.push(`Unknown staff candidate "${s.candidateId}"`);
    else if (!c.roles.includes(s.role)) errors.push(`${c.name} cannot work as ${s.role}`);
  }
  for (const c of plan.channels) {
    if (c.share <= 0) continue;
    const role = world.channels[c.type].staffRole;
    if (!plan.staff.some((s) => s.role === role)) warnings.push(`${world.channels[c.type].label} needs a ${role}, but none is hired — its pies will go unsold.`);
  }
  const cap = Math.floor(dailyConstructCapacity(world, plan) * plan.operatingDays);
  if (plan.weeklyProduction > cap) warnings.push(`Weekly production ${plan.weeklyProduction} exceeds the constructs' capacity of about ${cap} over ${plan.operatingDays} days; output will be capped.`);
  if (plan.weeklyProduction === 0) warnings.push("Weekly production is zero.");
  return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function createInitialState(world: WorldDefinition, planInput: BusinessPlanInput | BusinessPlan, opts: InitOptions): WorldState {
  const plan = parsePlan(planInput);
  const check = checkPlan(world, plan);
  if (check.errors.length) throw new Error(`Invalid plan: ${check.errors.join("; ")}`);
  const a = world.assumptions;
  const date = dateFromDay(world.calendar, opts.startDay);
  const staff = plan.staff.map((s) => hireStaff(world, s.candidateId, s.role, s.wageCpPerDay, opts.startDay));
  const startup =
    plan.guild === "member" ? a.guild.memberInitiationCp : plan.guild === "associate" ? a.guild.associateInitiationCp : 0;
  const state: WorldState = {
    schemaVersion: 1,
    worldId: world.id,
    branch: "sandbox",
    seed: opts.seed,
    startDay: opts.startDay,
    day: opts.startDay,
    plan,
    sandbox: { licensingOutcome: "approve", inspectionRulings: "uphold", partyTopUps: "when-cut-off", ...opts.sandbox },
    weather: initialWeather(world.climate, world.calendar, date),
    market: { meatShock: 0, grainShock: 0 },
    business: {
      status: "operating",
      cashCp: plan.startingCapitalCp - startup,
      minCashCp: plan.startingCapitalCp - startup,
      ownerDrawsCp: 0,
      hidden: { ...a.initialHidden },
      staff,
      wholesaleAccounts: plan.channels.some((c) => c.type === "wholesale" && c.share > 0) ? a.wholesale.initialAccounts : 0,
      licensing: { status: "pending", decisionDay: opts.licensingDecisionDay ?? opts.startDay + a.licensingDecisionAfterDays },
      consecutiveLossWeeks: 0,
      reinvestAdvertisingCp: 0,
      lastWeekProfitCp: 0,
      account: { location: "Business strongbox (location to be decided)", withdrawnCp: 0, depositedCp: 0, statement: [] },
    },
    threads: Object.fromEntries(world.threads.map((t) => [t.id, { id: t.id, stage: 0, progress: 0, peakStage: 0, lastChangeDay: opts.startDay, lastPressure: [] }])),
    conditions: [],
    modifiers: [],
    scheduled: [],
    pending: [],
    cooldowns: {},
    pacing: { lastPlayerDecisionDay: null, lastMajorDay: null },
    events: [],
    history: [],
    knowledge: [],
    weeks: [],
    current: newAccumulator(1, opts.startDay, plan.startingCapitalCp - startup, { ...a.initialHidden }),
    seq: 0,
    appliedInterventions: [],
  };
  state.business.account.statement.push({ id: nextId(state, "stmt"), day: opts.startDay, kind: "deposit", description: "Opening capital from the party", amountCp: plan.startingCapitalCp, balanceCp: plan.startingCapitalCp });
  if (startup > 0) {
    state.current.ledger.guildDues += startup;
    state.business.account.statement.push({ id: nextId(state, "stmt"), day: opts.startDay, kind: "one-off", description: "Guild initiation fee", amountCp: -startup, balanceCp: plan.startingCapitalCp - startup });
  }
  if (world.scheduled.some((s) => s.id === LICENSING_EVENT_ID)) {
    state.scheduled.push({ id: nextId(state, "sched"), eventId: LICENSING_EVENT_ID, day: state.business.licensing.decisionDay, data: {} });
  }
  return state;
}

function newAccumulator(index: number, startDay: number, cashStartCp: number, hiddenStart: WorldState["business"]["hidden"]): WeekAccumulator {
  return { index, startDay, days: [], ledger: emptyLedger(), cashStartCp, hiddenStart, tradingCp: 0, withdrawnCp: 0, depositedCp: 0 };
}

// ---------------------------------------------------------------------------
// Context and event firing
// ---------------------------------------------------------------------------

function estimatedWeeklyFixed(world: WorldDefinition, state: WorldState): number {
  const avgIngredient = state.weeks.length ? state.weeks[state.weeks.length - 1]!.ledger.ingredients / 7 : 0;
  const fixed = weeklyFixedCosts(world, state, avgIngredient).reduce((a, l) => a + l.amountCp, 0);
  const wages = state.business.staff.reduce((a, s) => a + s.wageCpPerDay, 0) * state.plan.operatingDays;
  return fixed + wages;
}

/**
 * The district's crew for this campaign: chosen once by the campaign's luck from the
 * district's candidates, so the same name stays in play for the whole campaign.
 */
export function withCampaignCrew(n: NeighborhoodDef, seed: string): NeighborhoodDef {
  const pool = n.crewCandidates?.filter(Boolean) ?? [];
  if (!pool.length) return n;
  const pick = pool[Math.floor(uniformFor(seed, "district-crew", n.id) * pool.length)]!;
  return pick === n.crewActorId ? n : { ...n, crewActorId: pick };
}

export function makeContext(world: WorldDefinition, state: WorldState, date: CalendarDate, extra: Partial<EventContext> = {}): EventContext {
  let derived: DerivedMetrics | undefined;
  const ctx: EventContext = {
    world,
    state,
    date,
    plan: state.plan,
    neighborhood: withCampaignCrew(world.neighborhoods[state.plan.neighborhood]!, state.seed),
    get derived() {
      derived ??= computeDerived(world, state, estimatedWeeklyFixed(world, state));
      return derived;
    },
    hasCondition: (id) => hasActiveCondition(state, id, date.absoluteDay),
    actorName: (id) => world.actors.find((a) => a.id === id)?.name ?? id,
    ...extra,
  } as EventContext;
  return ctx;
}

interface FireMeta {
  eventId: string;
  title: string;
  category: EventRecord["category"];
  probability?: number;
  drivers?: Driver[];
  threadId?: string;
  stage?: number;
  causeKind: AppliedChange["cause"]["kind"];
}

function fire(world: WorldDefinition, state: WorldState, date: CalendarDate, outcome: EventOutcome, meta: FireMeta): EventRecord {
  const record: EventRecord = {
    id: nextId(state, "evt"),
    day: date.absoluteDay,
    week: state.current.index,
    eventId: meta.eventId,
    title: outcome.title ?? meta.title,
    category: meta.category,
    severity: outcome.severity,
    playerText: outcome.playerText,
    dmText: outcome.dmText,
    visibleToPlayers: outcome.visibleToPlayers ?? true,
    probability: meta.probability,
    drivers: meta.drivers,
    effects: outcome.effects,
    sessionHook: outcome.sessionHook,
    threadId: meta.threadId,
    stage: meta.stage,
    provenance: "simulated",
  };
  state.events.push(record);
  if (record.severity === "major") state.pacing.lastMajorDay = date.absoluteDay;
  if (outcome.effects.length) {
    applyChange(world, state, {
      day: date.absoluteDay,
      authority: "simulation",
      cause: { kind: meta.causeKind, refId: record.id },
      description: record.title,
      effects: outcome.effects,
    });
  }
  if (outcome.decision) {
    const dec = outcome.decision;
    const pending: PendingDecision = {
      id: `dec:${meta.eventId}:${date.absoluteDay}:${state.seq + 1}`,
      day: date.absoluteDay,
      dueDay: date.absoluteDay + Math.max(0, Math.floor(dec.respondWithinDays ?? 0)),
      eventRecordId: record.id,
      authority: dec.authority,
      prompt: dec.prompt,
      options: dec.options,
      defaultOptionId: dec.defaultOptionId,
      standingOrder: dec.standingOrder,
      dmAssumption: dec.dmAssumption,
    };
    state.seq += 1;
    record.decisionId = pending.id;
    state.pending.push(pending);
    if (dec.authority === "players") state.pacing.lastPlayerDecisionDay = date.absoluteDay;
  }
  return record;
}

function evaluateConditional(world: WorldDefinition, state: WorldState, date: CalendarDate, phase: "morning" | "evening" | "weekly", extra: Partial<EventContext>): EventRecord[] {
  const fired: EventRecord[] = [];
  const day = date.absoluteDay;
  for (const def of world.events) {
    if (def.phase !== phase) continue;
    if ((state.cooldowns[def.id] ?? -Infinity) > day) continue;
    const pacing = world.pacing;
    if (def.pacing === "decision") {
      // Space out the party's decisions; never stack a new one on an unanswered one.
      const last = state.pacing.lastPlayerDecisionDay;
      if (last !== null && day - last < pacing.minDaysBetweenPlayerDecisions) continue;
      if (state.pending.some((x) => x.authority === "players")) continue;
    }
    const ctx = makeContext(world, state, date, extra);
    const hazard = def.hazard(ctx);
    let p = clamp01(hazard.probability);
    const drivers = [...hazard.drivers];
    const lastMajor = state.pacing.lastMajorDay;
    if (def.pacing === "adverse" && lastMajor !== null && day - lastMajor < pacing.quietDaysAfterMajor && p > 0) {
      drivers.push({ label: "Quiet spell after a major event (pacing)", value: -(p * (1 - pacing.quietHazardMultiplier)) });
      p *= pacing.quietHazardMultiplier;
    }
    if (p <= 0) continue;
    if (uniformFor(state.seed, "event", def.id, day) >= p) continue;
    const outcome = def.resolve(ctx, rngFor(state.seed, "event-resolve", def.id, day));
    state.cooldowns[def.id] = day + def.cooldownDays;
    fired.push(fire(world, state, date, outcome, { eventId: def.id, title: def.title, category: def.category, probability: round(p, 4), drivers, causeKind: "event" }));
  }
  return fired;
}

function processThreads(world: WorldDefinition, state: WorldState, date: CalendarDate): EventRecord[] {
  const fired: EventRecord[] = [];
  const day = date.absoluteDay;
  for (const def of world.threads) {
    const t = state.threads[def.id]!;
    const ctx = makeContext(world, state, date);
    const pressure = def.pressure(ctx);
    t.lastPressure = pressure.map((p) => ({ label: p.label, value: round(p.value, 3) }));
    if (t.frozenUntilDay !== undefined && t.frozenUntilDay >= day) continue;
    const weekly = pressure.reduce((a, p) => a + p.value, 0);
    const jitter = rngFor(state.seed, "thread", def.id, day).range(0.75, 1.25);
    t.progress = clamp(t.progress + (weekly / 7) * jitter, 0, def.maxProgress);

    if (day - t.lastChangeDay < def.minDwellDays) continue;
    const next = def.stages.find((s) => s.stage === t.stage + 1);
    const current = def.stages.find((s) => s.stage === t.stage);
    const lastEntry = next ? t.lastEntered?.[String(next.stage)] : undefined;
    const coolingDown = next?.repeatCooldownDays !== undefined && lastEntry !== undefined && day - lastEntry < next.repeatCooldownDays;
    const lastMajor = state.pacing.lastMajorDay;
    const majorSpacing = next?.major && lastMajor !== null && day - lastMajor < world.pacing.minDaysBetweenMajorEscalations;
    if (next && t.progress >= next.threshold && !coolingDown && !majorSpacing) {
      t.lastEntered = { ...(t.lastEntered ?? {}), [String(next.stage)]: day };
      t.stage = next.stage;
      t.peakStage = Math.max(t.peakStage, t.stage);
      t.lastChangeDay = day;
      const outcome = next.onEnter(makeContext(world, state, date), rngFor(state.seed, "thread-stage", def.id, next.stage, day));
      fired.push(
        fire(world, state, date, outcome, {
          eventId: `${def.id}:stage-${next.stage}`,
          title: `${def.title}: ${next.title}`,
          category: "thread",
          drivers: t.lastPressure,
          threadId: def.id,
          stage: next.stage,
          causeKind: "thread",
        }),
      );
    } else if (current && t.stage > 0 && t.progress < current.threshold - def.hysteresis) {
      const from = t.stage;
      t.stage -= 1;
      t.lastChangeDay = day;
      if (def.recede) {
        fired.push(
          fire(world, state, date, def.recede(makeContext(world, state, date), from), {
            eventId: `${def.id}:recede-${from}`,
            title: `${def.title}: easing`,
            category: "thread",
            drivers: t.lastPressure,
            threadId: def.id,
            stage: t.stage,
            causeKind: "thread",
          }),
        );
      }
    }
  }
  return fired;
}

function processScheduled(world: WorldDefinition, state: WorldState, date: CalendarDate): EventRecord[] {
  const day = date.absoluteDay;
  const due = state.scheduled.filter((s) => s.day === day);
  state.scheduled = state.scheduled.filter((s) => s.day !== day);
  const fired: EventRecord[] = [];
  for (const s of due) {
    const def = world.scheduled.find((x) => x.id === s.eventId);
    if (!def) continue;
    const outcome = def.resolve(makeContext(world, state, date), rngFor(state.seed, "scheduled", s.id, day), s.data);
    fired.push(fire(world, state, date, outcome, { eventId: def.id, title: def.title, category: def.category, causeKind: "scheduled" }));
  }
  return fired;
}

// ---------------------------------------------------------------------------
// Decisions and interventions
// ---------------------------------------------------------------------------

/** Apply a chosen option to a pending decision at its due day. Mutates the working state. */
function applyResolution(world: WorldDefinition, state: WorldState, decisionId: string, optionId: string, authority: Authority, note = ""): void {
  const pending = state.pending.find((p) => p.id === decisionId);
  if (!pending) throw new Error(`No pending decision ${decisionId}`);
  const option = pending.options.find((o) => o.id === optionId) ?? pending.options.find((o) => o.id === pending.defaultOptionId)!;
  state.pending = state.pending.filter((p) => p.id !== decisionId);
  const record = state.events.find((e) => e.id === pending.eventRecordId);
  if (record) record.resolution = { optionId: option.id, label: option.label, authority };
  applyChange(world, state, {
    day: pending.dueDay,
    authority,
    cause: { kind: "decision", refId: decisionId },
    description: `${pending.prompt} → ${option.label}${note}`,
    effects: option.effects,
  });
}

function automaticChoice(state: WorldState, p: PendingDecision): { optionId: string; authority: Authority } {
  if (p.authority === "players" && p.standingOrder) {
    const value = (state.plan.standingOrders as Record<string, string>)[p.standingOrder];
    if (value && p.options.some((o) => o.id === value)) return { optionId: value, authority: "standing-order" };
  }
  if (p.authority === "dm" && p.dmAssumption) {
    const value = (state.sandbox as unknown as Record<string, string>)[p.dmAssumption];
    if (value && p.options.some((o) => o.id === value)) return { optionId: value, authority: "sandbox-assumption" };
  }
  return { optionId: p.defaultOptionId, authority: p.authority === "dm" ? "sandbox-assumption" : "standing-order" };
}

/** Resolve a pending decision on a snapshot (returns a new state). */
export function resolveDecision(world: WorldDefinition, input: WorldState, decisionId: string, optionId: string, authority: Authority = "dm"): WorldState {
  const state = structuredClone(input);
  applyResolution(world, state, decisionId, optionId, authority);
  return state;
}

export interface Intervention {
  authority: Extract<Authority, "dm" | "players">;
  description: string;
  effects: Effect[];
  /** Optional link to a player proposal or session note. */
  refId?: string;
  recordedAt?: string;
}

/**
 * The World Intervention Layer's commit point: an approved, structured outcome of a
 * freeform action (or a DM correction) applied to the world with a full audit record.
 */
export function applyIntervention(world: WorldDefinition, input: WorldState, intervention: Intervention): { state: WorldState; change: AppliedChange } {
  const state = structuredClone(input);
  const refId = intervention.refId ?? `intervention-${state.seq + 1}`;
  const change = applyChange(world, state, {
    day: state.day,
    authority: intervention.authority,
    cause: { kind: "intervention", refId },
    description: intervention.description,
    effects: intervention.effects,
    recordedAt: intervention.recordedAt,
  });
  state.appliedInterventions.push(refId);
  return { state, change };
}

// ---------------------------------------------------------------------------
// Daily step and weekly close
// ---------------------------------------------------------------------------

function closeWeek(world: WorldDefinition, state: WorldState, date: CalendarDate): EventRecord[] {
  const acc = state.current;
  const b = state.business;
  const stats = weekStats(world, acc);
  const avgIngredient = acc.ledger.ingredients / 7;
  for (const line of weeklyFixedCosts(world, state, avgIngredient)) {
    acc.ledger[line.category] += line.amountCp;
    b.cashCp -= line.amountCp;
    acc.tradingCp = (acc.tradingCp ?? 0) - line.amountCp;
  }
  const wagesLate = b.cashCp < 0;

  const derivedBefore = computeDerived(world, state, estimatedWeeklyFixed(world, state));
  const hidden = updateHidden(world, state, stats, derivedBefore, date.absoluteDay);
  b.hidden = hidden.next;
  b.staff = updateStaff(world, state.plan, b.staff, stats);
  if (wagesLate) {
    // Wages went out late this week: everyone notices.
    const hit = world.assumptions.account.unpaidWageMoraleHit;
    b.staff = b.staff.map((s) => ({ ...s, morale: Math.max(0, s.morale - hit) }));
  }
  const wholesale = updateWholesaleAccounts(world, state, stats);
  b.wholesaleAccounts = wholesale.accounts;

  const weeklyEvents = evaluateConditional(world, state, date, "weekly", { week: acc });

  const revenue = ledgerIncome(acc.ledger);
  const costs = ledgerCosts(acc.ledger);
  const profit = revenue - costs;
  b.lastWeekProfitCp = profit;
  b.consecutiveLossWeeks = profit < 0 ? b.consecutiveLossWeeks + 1 : 0;
  b.reinvestAdvertisingCp = profit > 0 ? Math.round(profit * state.plan.finance.reinvestAdvertisingShare) : 0;
  // Sandbox assumption: once suppliers have cut the business off, the party settles the debts at week's end.
  if (state.sandbox.partyTopUps === "when-cut-off" && acc.days.some((d) => d.reason === "suppliers won't deliver until the bills are paid") && b.cashCp < 0) {
    applyChange(world, state, {
      day: date.absoluteDay,
      authority: "sandbox-assumption",
      cause: { kind: "scheduled", refId: `top-up-week-${acc.index}` },
      description: "The party covers the business's debts (sandbox assumption)",
      effects: [{ kind: "account", action: "deposit", amountCp: -b.cashCp, note: "The party covered the business's debts (sandbox assumption)" }],
    });
  }
  const takings = acc.days.reduce((x, d) => x + d.revenueReportedCp, 0);
  b.account.statement.push({
    id: nextId(state, "stmt"),
    day: date.absoluteDay,
    kind: "trading",
    description: `Week ${acc.index} trading: takings ${formatCp(takings)} less running costs ${formatCp(takings - (acc.tradingCp ?? 0))}`,
    amountCp: acc.tradingCp ?? 0,
    balanceCp: b.cashCp,
  });
  let draw = 0;
  if (state.plan.finance.payoutMode === "automatic" && b.cashCp > state.plan.finance.reserveTargetCp) {
    draw = Math.floor((b.cashCp - state.plan.finance.reserveTargetCp) * state.plan.finance.ownerDrawShare);
  }
  b.cashCp -= draw;
  b.ownerDrawsCp += draw;
  if (draw > 0) b.account.statement.push({ id: nextId(state, "stmt"), day: date.absoluteDay, kind: "payout", description: "Automatic payout to the party (standing order)", amountCp: -draw, balanceCp: b.cashCp, authority: "standing-order" });
  b.minCashCp = Math.min(b.minCashCp, b.cashCp);

  const derived = computeDerived(world, state, estimatedWeeklyFixed(world, state));
  const conditions: WeekRecord["weather"]["conditions"] = {};
  for (const d of acc.days) conditions[d.weather.condition] = (conditions[d.weather.condition] ?? 0) + 1;
  const channelSold: WeekRecord["channelSold"] = {};
  for (const d of acc.days) for (const c of d.channels) channelSold[c.channel] = (channelSold[c.channel] ?? 0) + c.sold;
  const drivers = Object.fromEntries(
    Object.entries(hidden.drivers).map(([k, list]) => [k, (list ?? []).map((x) => ({ label: x.label, value: round(x.value, 3) }))]),
  );
  if (wholesale.drivers.length) (drivers as Record<string, Driver[]>).wholesaleAccounts = wholesale.drivers;

  const record: WeekRecord = {
    index: acc.index,
    startDay: acc.startDay,
    endDay: date.absoluteDay,
    produced: stats.produced,
    sold: stats.sold,
    waste: stats.waste,
    stockoutDays: stats.stockoutDays,
    operatingDays: stats.operatingDays,
    channelSold,
    ledger: { ...acc.ledger },
    revenueCp: revenue,
    costsCp: costs,
    profitCp: profit,
    skimmedCp: acc.days.reduce((a, d) => a + d.skimmedCp, 0),
    ownerDrawCp: draw,
    creditSurchargeCp: acc.days.reduce((a, d) => a + (d.creditSurchargeCp ?? 0), 0),
    wagesLate,
    withdrawnCp: acc.withdrawnCp ?? 0,
    depositedCp: acc.depositedCp ?? 0,
    ...(() => {
      const summary = accountSummary(world, state);
      return { accountStatus: accountStatusOf(b.cashCp, summary.floorCp, summary.creditLimitCp), accountFloorCp: summary.floorCp };
    })(),
    cashStartCp: acc.cashStartCp,
    cashEndCp: b.cashCp,
    hiddenStart: acc.hiddenStart,
    hiddenEnd: { ...b.hidden },
    drivers,
    derived,
    staff: b.staff.map((s) => ({ id: s.id, name: s.name, role: s.role, competence: round(s.competence, 1), morale: round(s.morale, 1), loyalty: round(s.loyalty, 1), skimmedCp: s.skimmedCp })),
    threads: world.threads.map((t) => {
      const ts = state.threads[t.id]!;
      return { id: t.id, stage: ts.stage, progress: round(ts.progress, 2), pressure: round(ts.lastPressure.reduce((a, p) => a + p.value, 0), 2) };
    }),
    wholesaleAccounts: b.wholesaleAccounts,
    weather: { conditions, avgTempC: round(acc.days.reduce((a, d) => a + d.weather.temperatureC, 0) / Math.max(1, acc.days.length), 1) },
    festivals: [...new Set(acc.days.flatMap((d) => d.festivals))],
    avgPriceIndex: round(acc.days.reduce((a, d) => a + d.priceIndex, 0) / Math.max(1, acc.days.length), 3),
    eventIds: state.events.filter((e) => e.week === acc.index).map((e) => e.id),
  };
  state.weeks.push(record);
  state.current = newAccumulator(acc.index + 1, date.absoluteDay + 1, b.cashCp, { ...b.hidden });
  return weeklyEvents;
}

function simulateDay(world: WorldDefinition, state: WorldState): EventRecord[] {
  const day = state.day;
  const date = dateFromDay(world.calendar, day);
  const b = state.business;
  const fired: EventRecord[] = [];

  // 1. Environment
  state.weather = nextWeatherFor(world, state, date);
  state.market = nextMarketFor(world, state, day);

  // 2. Expiry
  state.modifiers = state.modifiers.filter((m) => m.untilDay >= day);
  state.conditions = state.conditions.filter((c) => c.untilDay === undefined || c.untilDay >= day);
  if (b.status === "suspended" && (b.suspendedUntilDay ?? 0) < day) {
    b.status = "operating";
    b.suspendedUntilDay = undefined;
    fired.push(
      fire(world, state, date, { severity: "minor", playerText: "The suspension has lapsed; the business may trade again.", dmText: "Suspension ended.", effects: [] }, { eventId: "suspension-ended", title: "Trading resumes", category: "scheduled", causeKind: "scheduled" }),
    );
  }

  // 3-5. Scheduled, threads, morning events
  fired.push(...processScheduled(world, state, date));
  fired.push(...processThreads(world, state, date));
  fired.push(...evaluateConditional(world, state, date, "morning", {}));

  // 6. Operations
  const ops = runOperations(world, state, date);
  state.current.days.push(ops.record);
  let net = 0;
  for (const [k, v] of Object.entries(ops.ledger) as [keyof typeof ops.ledger, number][]) {
    state.current.ledger[k] += v;
    net += k === "revenue" ? v : -v;
  }
  b.cashCp += net;
  state.current.tradingCp = (state.current.tradingCp ?? 0) + net;
  if (ops.record.skimmedCp > 0) {
    // Attribute skimming to the dishonest staff who handled cash (hidden from players).
    const takers = b.staff.filter((s) => s.traits.honesty < world.assumptions.dynamics.skimming.honestyThreshold && !ops.record.absentStaff.includes(s.id));
    for (const s of takers) s.skimmedCp += Math.round(ops.record.skimmedCp / takers.length);
  }

  // 7. Evening events
  fired.push(...evaluateConditional(world, state, date, "evening", { today: ops.record }));

  // 8. Weekly close
  if ((day - state.startDay + 1) % 7 === 0) fired.push(...closeWeek(world, state, date));

  b.minCashCp = Math.min(b.minCashCp, b.cashCp);
  state.day = day + 1;
  return fired;
}

// Small indirections so weather/market streams are clearly keyed by seed + day.
function nextWeatherFor(world: WorldDefinition, state: WorldState, date: CalendarDate) {
  return nextWeather(world.climate, world.calendar, state.weather, date, state.seed);
}
function nextMarketFor(world: WorldDefinition, state: WorldState, day: number) {
  return nextMarket(world.market, state.market, day, state.seed);
}

// ---------------------------------------------------------------------------
// Public runner
// ---------------------------------------------------------------------------

export function runSimulation(world: WorldDefinition, input: WorldState, options: RunOptions = {}): RunResult {
  const state = structuredClone(input);
  const pause = options.pause ?? "never";
  const resolutions = options.resolutions ?? {};
  const acknowledged = new Set(options.acknowledged ?? []);
  const untilDay = options.untilDay ?? state.day + (options.weeks ?? 26) * 7 - 1;

  // Resolve every decision whose due day has ended (the day just simulated, or earlier
  // for a state handed over from a paused run). Decisions that can still wait stay open.
  const settle = (): RunResult | null => {
    const lastDay = state.day - 1;
    const due = state.pending.filter((p) => p.dueDay <= lastDay).sort((a, b) => a.dueDay - b.dueDay || a.id.localeCompare(b.id));
    const blocking: string[] = [];
    for (const p of due) {
      const supplied = resolutions[p.id];
      if (supplied) {
        applyResolution(world, state, p.id, supplied, p.authority === "dm" ? "dm" : "players");
        continue;
      }
      if (pause !== "never") {
        blocking.push(p.id);
        continue;
      }
      const auto = automaticChoice(state, p);
      applyResolution(world, state, p.id, auto.optionId, auto.authority, p.dueDay > p.day ? " (no answer by the deadline)" : "");
    }
    return blocking.length ? { state, status: "paused", pending: [...state.pending], blocking } : null;
  };

  const early = settle();
  if (early) return early;

  const interventions = (options.interventions ?? []).map((iv, i) => ({ ...iv, refId: iv.refId ?? `scheduled-${iv.day}-${i}` }));
  // Apply scheduled interventions for a day exactly once, even across replays and split runs.
  const applyScheduled = (day: number) => {
    for (const iv of interventions.filter((x) => x.day === day && !state.appliedInterventions.includes(x.refId))) {
      applyChange(world, state, { day, authority: iv.authority, cause: { kind: "intervention", refId: iv.refId }, description: iv.description, effects: iv.effects });
      state.appliedInterventions.push(iv.refId);
    }
  };
  while (state.day <= untilDay) {
    applyScheduled(state.day);
    const fired = simulateDay(world, state);
    const halted = settle();
    if (halted) return halted;
    if (options.stopWhenNeededAfterDay !== undefined && state.day - 1 > options.stopWhenNeededAfterDay) {
      const trigger = fired.find((e) => (e.decisionId !== undefined || e.severity === "major") && !acknowledged.has(e.id));
      if (trigger) return { state, status: "paused", pending: [...state.pending], blocking: [], pausedOnEvent: trigger };
    }
    if (pause === "decisions-and-major") {
      const major = fired.find((e) => e.severity === "major" && !acknowledged.has(e.id));
      if (major) return { state, status: "paused", pending: [...state.pending], blocking: [], pausedOnEvent: major };
    }
  }
  // Anything recorded for "first thing tomorrow" (e.g. a withdrawal the DM just entered) shows immediately.
  applyScheduled(state.day);
  return { state, status: "completed", pending: [...state.pending], blocking: [] };
}

export interface ScenarioRunInput {
  plan: BusinessPlanInput | BusinessPlan;
  seed: string;
  /** Length of the run in weeks (ignored when `days` is given). */
  weeks: number;
  /** Length of the run in days (allows partial weeks). */
  days?: number;
  startDay: number;
  interventions?: ScheduledIntervention[];
  stopWhenNeededAfterDay?: number;
  pause?: PauseMode;
  resolutions?: Record<string, string>;
  acknowledged?: string[];
  sandbox?: Partial<SandboxAssumptions>;
}

/** Create a fresh business and run it. Deterministic in all inputs. */
export function simulateScenario(world: WorldDefinition, input: ScenarioRunInput): RunResult {
  const initial = createInitialState(world, input.plan, { seed: input.seed, startDay: input.startDay, sandbox: input.sandbox });
  return runSimulation(world, initial, {
    untilDay: input.startDay + (input.days ?? input.weeks * 7) - 1,
    pause: input.pause,
    resolutions: input.resolutions,
    acknowledged: input.acknowledged,
    interventions: input.interventions,
    stopWhenNeededAfterDay: input.stopWhenNeededAfterDay,
  });
}

/** Snapshot = JSON round trip. Exists to make the persistence contract explicit and testable. */
export function snapshot(state: WorldState): string {
  return JSON.stringify(state);
}

export function restore(json: string): WorldState {
  const parsed = JSON.parse(json) as WorldState;
  if (parsed.schemaVersion !== 1) throw new Error(`Unsupported state schema ${String(parsed.schemaVersion)}`);
  return parsed;
}

export { applyEffect };
