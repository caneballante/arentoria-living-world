/**
 * Campaigns: the DM's real campaign and a throwaway test campaign, run on the DM's own
 * machine. Pure functions over a JSON-serializable CampaignFile (storage lives in
 * src/persistence/campaign-files.ts).
 *
 * How it stays honest:
 *  - Each published report stores the engine state at its end. Later runs continue from
 *    that snapshot, so published history never changes, not even when the simulation's
 *    numbers are recalibrated later.
 *  - Between reports, the DM's inputs (answers, plan changes, money in and out) are kept
 *    as a "draft" and replayed from the last snapshot. The engine is deterministic, so
 *    the draft can be rewound and re-run, but nothing is official until it is published.
 *  - The real campaign can only be started over before its first report; after that the
 *    DM can undo the latest report (a deliberate, recorded step). The test campaign can
 *    be restarted at any time.
 */
import { dateFromDay, formatDate } from "../engine/calendar";
import { parsePlan, safeParsePlan, type BusinessPlanInput } from "../engine/plan";
import { checkPlan, createInitialState, restore, runSimulation, snapshot, type PauseMode, type RunResult, type ScheduledIntervention } from "../engine/simulate";
import type { SandboxAssumptions, WorldDefinition, WorldState } from "../engine/types";
import { buildDmView, type DmView } from "../views";
import { buildCalendarGuide, type CalendarGuide } from "../views/calendar-guide";
import { buildEdition, type EditionContent } from "../views/edition";

export const CAMPAIGN_IDS = ["party", "test"] as const;
export type CampaignId = (typeof CAMPAIGN_IDS)[number];
export const isCampaignId = (x: string): x is CampaignId => (CAMPAIGN_IDS as readonly string[]).includes(x);

/** How many recent reports keep a full engine snapshot (enough to undo a couple). */
const SNAPSHOTS_KEPT = 3;

export interface CampaignInputs {
  resolutions: Record<string, string>;
  acknowledged: string[];
  interventions: ScheduledIntervention[];
}

export interface CampaignDraft extends CampaignInputs {
  /** The last day the DM asked the clock to reach (absolute day). */
  targetDay: number;
  /** "Until something needs the party": stop after this absolute day. */
  stopFrom?: number;
}

export interface EditionRecord {
  number: number;
  fromDay: number;
  toDay: number;
  publishedAt: string;
  note: string;
  deadline: string;
  /** The inputs applied during this stretch (restored if the report is undone). */
  inputs: CampaignInputs;
  /** Engine state at the end of the stretch; kept for the latest few reports. */
  snapshot: string | null;
  content: EditionContent;
  /** When this report was last sent to DungeonShare (cleared when it is taken down). */
  sentAt?: string;
}

export interface CampaignFile {
  format: 1;
  id: CampaignId;
  name: string;
  kind: "real" | "test";
  seed: string;
  startDay: number;
  startScenario: string;
  /** The calendar version the campaign started under (published reports keep its dates). */
  calendarId?: string;
  createdAt: string;
  updatedAt: string;
  /** When the clock stops: on decisions (and major events), or never (standing orders decide). */
  pause: PauseMode;
  initialSnapshot: string;
  draft: CampaignDraft;
  editions: EditionRecord[];
  nextRef: number;
}

export class CampaignError extends Error {}

export interface NewCampaign {
  id: CampaignId;
  name: string;
  plan: BusinessPlanInput;
  seed: string;
  startDay: number;
  startScenario: string;
  now: string;
  sandbox?: Partial<SandboxAssumptions>;
}

export function createCampaign(world: WorldDefinition, o: NewCampaign): CampaignFile {
  const parsed = safeParsePlan(o.plan);
  if (!parsed.success) throw new CampaignError(`The starting plan is invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  const check = checkPlan(world, parsed.data);
  if (check.errors.length) throw new CampaignError(`The starting plan needs fixing: ${check.errors.join(" ")}`);
  // Real play: nobody quietly covers debts; the DM records deposits.
  const state = createInitialState(world, parsed.data, { seed: o.seed, startDay: o.startDay, sandbox: { partyTopUps: "never", ...o.sandbox } });
  return {
    format: 1,
    id: o.id,
    name: o.name,
    kind: o.id === "party" ? "real" : "test",
    seed: o.seed,
    startDay: o.startDay,
    startScenario: o.startScenario,
    calendarId: world.calendar.id,
    createdAt: o.now,
    updatedAt: o.now,
    pause: "decisions-and-major",
    initialSnapshot: snapshot(state),
    draft: { targetDay: o.startDay - 1, resolutions: {}, acknowledged: [], interventions: [] },
    editions: [],
    nextRef: 1,
  };
}

export function publishedDay(c: CampaignFile): number {
  return c.editions.length ? c.editions[c.editions.length - 1]!.toDay : c.startDay - 1;
}

function baseState(c: CampaignFile): WorldState {
  for (let i = c.editions.length - 1; i >= 0; i--) {
    const e = c.editions[i]!;
    if (e.snapshot) return restore(e.snapshot);
    break; // the latest report always keeps its snapshot
  }
  return restore(c.initialSnapshot);
}

/** Re-run the draft from the last published report. Deterministic, so it's cheap to repeat. */
export function runDraft(world: WorldDefinition, c: CampaignFile): RunResult {
  const base = baseState(c);
  return runSimulation(world, base, {
    untilDay: Math.max(c.draft.targetDay, base.day - 1),
    pause: c.pause,
    resolutions: c.draft.resolutions,
    acknowledged: c.draft.acknowledged,
    interventions: c.draft.interventions,
    stopWhenNeededAfterDay: c.draft.stopFrom,
  });
}

const lastDayOf = (r: RunResult) => r.state.day - 1;
/** Only a question due today blocks the clock; a stop on an event just needs noting. */
const isBlocked = (r: RunResult) => r.blocking.length > 0;
const BLOCKED = "The clock is stopped on a question that's due today: answer it first.";

export interface CampaignSummary {
  id: CampaignId;
  name: string;
  kind: "real" | "test";
  seed: string;
  startScenario: string;
  createdAt: string;
  pause: PauseMode;
  startDate: string;
  publishedThrough: { day: number; date: string } | null;
  reports: { number: number; from: string; to: string; publishedAt: string; deadline: string; note: string; questions: number; sentAt: string | null }[];
  draftDays: number;
  canStartOver: boolean;
  canUndo: boolean;
  /** Set when the calendar has changed since the campaign began. */
  calendarNote: string | null;
}

export function summarize(world: WorldDefinition, c: CampaignFile, result?: RunResult): CampaignSummary {
  const fmt = (day: number) => formatDate(dateFromDay(world.calendar, day), world.calendar);
  const pub = publishedDay(c);
  const last = result ? lastDayOf(result) : pub;
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    seed: c.seed,
    startScenario: c.startScenario,
    createdAt: c.createdAt,
    pause: c.pause,
    startDate: fmt(c.startDay),
    publishedThrough: c.editions.length ? { day: pub - c.startDay + 1, date: fmt(pub) } : null,
    reports: c.editions.map((e) => ({ number: e.number, from: e.content.period.from, to: e.content.period.to, publishedAt: e.publishedAt, deadline: e.deadline, note: e.note, questions: e.content.questions.length, sentAt: e.sentAt ?? null })),
    draftDays: Math.max(0, last - pub),
    canStartOver: c.kind === "test" || c.editions.length === 0,
    canUndo: c.editions.length > 0 && (c.editions.length === 1 || !!c.editions[c.editions.length - 2]!.snapshot),
    calendarNote:
      c.calendarId !== world.calendar.id
        ? `This campaign began under an earlier calendar. Published reports keep their dates; days after the last report now follow ${world.calendar.label}.`
        : null,
  };
}

export interface CampaignView {
  campaign: CampaignSummary;
  view: DmView;
  /** Answers recorded so far for questions that are still open. */
  answers: Record<string, string>;
  /** Where the clock is in the year, and the months since the last report. */
  calendar: CalendarGuide;
  /** Filled in by the server: whether reports can be sent to DungeonShare from this campaign. */
  dungeonShare?: { ready: boolean; site: string; note: string };
}

export function campaignView(world: WorldDefinition, c: CampaignFile): CampaignView {
  const result = runDraft(world, c);
  const last = Math.max(result.state.day - 1, c.startDay);
  return {
    campaign: summarize(world, c, result),
    view: buildDmView(world, result, { digestFromDay: publishedDay(c) + 1 }),
    answers: c.draft.resolutions,
    calendar: buildCalendarGuide(world, Math.min(publishedDay(c) + 1, last), last),
  };
}

const touch = (c: CampaignFile, now: string): CampaignFile => ({ ...c, updatedAt: now });

// --- Moving the clock -------------------------------------------------------------

export function advance(world: WorldDefinition, c: CampaignFile, days: number, untilNeeded: boolean, now: string): CampaignFile {
  if (!Number.isInteger(days) || days < 1 || days > 26 * 7) throw new CampaignError("Advance between 1 day and 26 weeks at a time.");
  const r = runDraft(world, c);
  if (isBlocked(r)) throw new CampaignError(BLOCKED);
  const last = lastDayOf(r);
  // Moving on from a stop counts as noting the event that caused it.
  const acknowledged = r.pausedOnEvent ? [...new Set([...c.draft.acknowledged, r.pausedOnEvent.id])] : c.draft.acknowledged;
  return touch({ ...c, draft: { ...c.draft, acknowledged, targetDay: last + days, stopFrom: untilNeeded ? last : undefined } }, now);
}

/** Back to the end of the last published report. Recorded answers and changes are kept. */
export function rewind(c: CampaignFile, now: string): CampaignFile {
  return touch({ ...c, draft: { ...c.draft, targetDay: publishedDay(c), stopFrom: undefined } }, now);
}

export function setPause(c: CampaignFile, pause: PauseMode, now: string): CampaignFile {
  return touch({ ...c, pause }, now);
}

// --- Recording what the party decided ------------------------------------------------

export function answer(world: WorldDefinition, c: CampaignFile, decisionId: string, optionId: string, now: string): CampaignFile {
  const r = runDraft(world, c);
  const p = r.pending.find((x) => x.id === decisionId);
  if (!p) throw new CampaignError("That question is no longer open.");
  if (!p.options.some((o) => o.id === optionId)) throw new CampaignError("That isn't one of the answers.");
  return touch({ ...c, draft: { ...c.draft, resolutions: { ...c.draft.resolutions, [decisionId]: optionId } } }, now);
}

export function acknowledge(world: WorldDefinition, c: CampaignFile, eventId: string, now: string): CampaignFile {
  const r = runDraft(world, c);
  const last = lastDayOf(r);
  return touch({ ...c, draft: { ...c.draft, acknowledged: [...new Set([...c.draft.acknowledged, eventId])], stopFrom: c.draft.stopFrom !== undefined ? last : undefined } }, now);
}

/** A plan revision (orders, staff, prices, or a new business size) from tomorrow. */
export function revisePlan(world: WorldDefinition, c: CampaignFile, planInput: BusinessPlanInput, now: string): CampaignFile {
  const parsed = safeParsePlan(planInput);
  if (!parsed.success) throw new CampaignError(`The plan is invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
  const check = checkPlan(world, parsed.data);
  if (check.errors.length) throw new CampaignError(`The plan needs fixing: ${check.errors.join(" ")}`);
  const r = runDraft(world, c);
  if (isBlocked(r)) throw new CampaignError(BLOCKED);
  const day = lastDayOf(r) + 1;
  // Before anything has happened, simply start with the new plan.
  if (day === c.startDay && c.editions.length === 0) {
    const fresh = createInitialState(world, parsed.data, { seed: c.seed, startDay: c.startDay, sandbox: restore(c.initialSnapshot).sandbox });
    return touch({ ...c, initialSnapshot: snapshot(fresh) }, now);
  }
  const resized = parsed.data.stage !== r.state.plan.stage;
  const size = world.stages[parsed.data.stage]?.label ?? parsed.data.stage;
  const kept = c.draft.interventions.filter((iv) => !(iv.day === day && iv.refId?.startsWith("plan-")));
  const iv: ScheduledIntervention = {
    day,
    authority: resized ? "dm" : "players",
    description: resized ? `The DM changed the business size to "${size}" and revised the plan` : "Business plan revised between sessions",
    refId: `plan-${c.nextRef}`,
    effects: [{ kind: "plan", patch: parsePlan(planInput), note: resized ? `Business size: ${size}` : "Plan revised" }],
  };
  return touch({ ...c, nextRef: c.nextRef + 1, draft: { ...c.draft, interventions: [...kept, iv] } }, now);
}

export interface AccountEntryInput {
  action: "withdraw" | "deposit" | "relocate";
  amountCp?: number;
  location?: string;
  note: string;
}

/** Money in or out of the business (or where it's kept), first thing tomorrow. */
export function recordAccount(world: WorldDefinition, c: CampaignFile, a: AccountEntryInput, now: string): CampaignFile {
  if (a.action !== "relocate" && !(Number.isFinite(a.amountCp) && (a.amountCp ?? 0) > 0)) throw new CampaignError("Enter an amount.");
  if (a.action === "relocate" && !a.location?.trim()) throw new CampaignError("Say where the money is kept now.");
  const r = runDraft(world, c);
  const day = lastDayOf(r) + 1;
  const label = a.action === "withdraw" ? "Withdrawal" : a.action === "deposit" ? "Deposit" : "Money moved";
  const iv: ScheduledIntervention = {
    day,
    authority: "dm",
    description: `${label} recorded by the DM${a.note ? `: ${a.note}` : ""}`,
    refId: `account-${c.nextRef}`,
    effects: [{ kind: "account", action: a.action, amountCp: a.amountCp, location: a.location, note: a.note }],
  };
  return touch({ ...c, nextRef: c.nextRef + 1, draft: { ...c.draft, interventions: [...c.draft.interventions, iv] } }, now);
}

// --- Publishing ----------------------------------------------------------------------

export function publish(world: WorldDefinition, c: CampaignFile, o: { note: string; deadline: string; now: string; publishedAt: string }): CampaignFile {
  const r = runDraft(world, c);
  if (isBlocked(r)) throw new CampaignError(BLOCKED);
  const from = publishedDay(c) + 1;
  const to = lastDayOf(r);
  if (to < from) throw new CampaignError("Nothing new to publish: move the clock forward first.");
  const number = c.editions.length + 1;
  const content = buildEdition(world, r, { number, fromDay: from, toDay: to, publishedAt: o.publishedAt, deadline: o.deadline.trim(), note: o.note.trim() });
  const record: EditionRecord = {
    number,
    fromDay: from,
    toDay: to,
    publishedAt: o.publishedAt,
    note: o.note.trim(),
    deadline: o.deadline.trim(),
    inputs: structuredClone({ resolutions: c.draft.resolutions, acknowledged: c.draft.acknowledged, interventions: c.draft.interventions }),
    snapshot: snapshot(r.state),
    content,
  };
  // Keep only what still lies ahead: answers to questions that are still open, and
  // changes scheduled after the report's last day that haven't been applied yet.
  const open = new Set(r.state.pending.map((p) => p.id));
  const applied = new Set(r.state.appliedInterventions);
  const carry: CampaignDraft = {
    targetDay: to,
    resolutions: Object.fromEntries(Object.entries(c.draft.resolutions).filter(([id]) => open.has(id))),
    acknowledged: [],
    interventions: c.draft.interventions.filter((iv) => !iv.refId || !applied.has(iv.refId)),
  };
  const editions = [...c.editions, record].map((e, i, all) => (i < all.length - SNAPSHOTS_KEPT ? { ...e, snapshot: null } : e));
  return touch({ ...c, editions, draft: carry }, o.now);
}

/** Record that a report was sent to DungeonShare (or, with null, taken down from it). */
export function markSent(c: CampaignFile, number: number, sentAt: string | null, now: string): CampaignFile {
  if (!c.editions.some((e) => e.number === number)) throw new CampaignError(`There is no Report ${number}.`);
  return touch({ ...c, editions: c.editions.map((e) => (e.number === number ? { ...e, sentAt: sentAt ?? undefined } : e)) }, now);
}

/** Undo the latest report: it goes back to being a draft (a deliberate DM step). */
export function undoPublish(c: CampaignFile, now: string): CampaignFile {
  const last = c.editions[c.editions.length - 1];
  if (!last) throw new CampaignError("There is no report to undo.");
  if (last.sentAt) throw new CampaignError(`Report ${last.number} is on DungeonShare. Take it down first.`);
  const prev = c.editions[c.editions.length - 2];
  if (prev && !prev.snapshot) throw new CampaignError("That report is too old to undo.");
  const ivs = new Map(last.inputs.interventions.map((iv) => [iv.refId ?? JSON.stringify(iv), iv]));
  for (const iv of c.draft.interventions) ivs.set(iv.refId ?? JSON.stringify(iv), iv);
  return touch(
    {
      ...c,
      editions: c.editions.slice(0, -1),
      draft: {
        targetDay: Math.max(c.draft.targetDay, last.toDay),
        resolutions: { ...last.inputs.resolutions, ...c.draft.resolutions },
        acknowledged: [...new Set([...last.inputs.acknowledged, ...c.draft.acknowledged])],
        interventions: [...ivs.values()],
      },
    },
    now,
  );
}
