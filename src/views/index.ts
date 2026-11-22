/**
 * View models. The server builds one of these from a simulation result; clients only
 * ever receive a view, never raw state. The player view is constructed by explicit
 * allow-listing (not by deleting fields), so hidden variables cannot leak by accident.
 */
import { dateFromDay, formatDate, formatShortDate } from "../engine/calendar";
import { accountSummary, type AccountSummary } from "../engine/account";
import { describeEffect } from "../engine/effects";
import type { BusinessPlan } from "../engine/plan";
import type { RunResult } from "../engine/simulate";
import type { EventRecord, PendingDecision, WeekRecord, WorldDefinition, WorldState } from "../engine/types";
import { buildDigest, type Digest } from "../narrative/digest";
import { buildAllReports, explainWeek, type ReportLine } from "../narrative/weekly-report";

export const SANDBOX_NOTICE = "Sandbox simulation — provisional results, not campaign canon. Nothing here changes the campaign until the DM approves it.";

/** Where the clock stands, for both views. */
export interface ClockInfo {
  startDay: number;
  /** Last simulated absolute day (startDay − 1 before anything has run). */
  lastDay: number;
  daysElapsed: number;
  date: string;
  weekNumber: number;
  dayOfWeek: number;
}

export interface PartialWeek {
  daysElapsed: number;
  sold: number;
  takingsCp: number;
}

/** The business account as the party sees it: balance, floor, and a dated statement. */
export interface AccountView extends AccountSummary {
  statement: { id: string; date: string; kind: string; description: string; amountCp: number; balanceCp?: number; by?: string }[];
}

function accountView(world: WorldDefinition, state: WorldState): AccountView {
  const short = (day: number) => formatShortDate(dateFromDay(world.calendar, day));
  const by = (a?: string) => (a === "dm" ? "DM" : a === "players" ? "party" : a === "standing-order" ? "standing order" : a === "sandbox-assumption" ? "sandbox assumption" : undefined);
  return {
    ...accountSummary(world, state),
    statement: state.business.account.statement.map((e) => ({ id: e.id, date: short(e.day), kind: e.kind, description: e.description, amountCp: e.amountCp, balanceCp: e.balanceCp, by: by(e.authority) })),
  };
}

export interface ViewOptions {
  /** Build a "since last time" digest starting at this absolute day. */
  digestFromDay?: number;
}

export interface PlayerWeek {
  index: number;
  dateRange: string;
  produced: number;
  sold: number;
  waste: number;
  revenueCp: number;
  costsCp: number;
  profitCp: number;
  ownerDrawCp: number;
  cashEndCp: number;
  ledger: WeekRecord["ledger"];
  festivals: string[];
  weather: WeekRecord["weather"];
}

export interface PlayerView {
  kind: "player";
  notice: string;
  status: RunResult["status"];
  period: { start: string; end: string };
  business: {
    name: string;
    identity: string;
    neighborhood: string;
    status: WorldState["business"]["status"];
    cashCp: number;
    ownerDrawsCp: number;
    licensing: WorldState["business"]["licensing"]["status"];
    staff: { name: string; role: string; wageCpPerDay: number }[];
  };
  plan: BusinessPlan;
  weeks: PlayerWeek[];
  reports: { week: number; title: string; dateRange: string; lines: Omit<ReportLine, "basis">[] }[];
  events: { id: string; date: string; title: string; text: string; severity: EventRecord["severity"]; resolution?: string; decidedBy?: "us" | "others" }[];
  knowledge: { date: string; topic: string; text: string }[];
  conditions: string[];
  pending: { id: string; prompt: string; dueDate: string; dueDay: number; dueNow: boolean; options: { id: string; label: string; description: string }[] }[];
  clock: ClockInfo;
  currentWeek: PartialWeek;
  digest?: { title: string; lines: Omit<ReportLine, "basis">[] };
  /** Why the clock stopped (player-safe wording). */
  stoppedOn?: { id: string; title: string; text: string; severity: EventRecord["severity"] };
  account: AccountView;
}

export interface DmView {
  kind: "dm";
  notice: string;
  status: RunResult["status"];
  period: { start: string; end: string };
  state: Omit<WorldState, "current"> & { current: Omit<WorldState["current"], "days"> };
  reports: ReturnType<typeof buildAllReports>;
  explanations: { week: number; variables: ReturnType<typeof explainWeek> }[];
  pending: (PendingDecision & { optionEffects: Record<string, string[]>; dueDate: string; dueNow: boolean })[];
  pausedOnEvent?: EventRecord;
  clock: ClockInfo;
  currentWeek: PartialWeek;
  digest?: Digest;
  account: AccountView;
  days: WorldState["current"]["days"];
  labels: {
    actors: Record<string, string>;
    threads: Record<string, { title: string; maxProgress: number; stages: { stage: number; title: string; threshold: number }[] }>;
    staff: Record<string, { name: string; blurb: string; traits: { competence: number; honesty: number; reliability: number } }>;
  };
}

function clock(world: WorldDefinition, state: WorldState): ClockInfo {
  const lastDay = state.day - 1;
  const elapsed = state.day - state.startDay;
  return {
    startDay: state.startDay,
    lastDay,
    daysElapsed: elapsed,
    date: formatDate(dateFromDay(world.calendar, Math.max(state.startDay, lastDay)), world.calendar),
    weekNumber: Math.floor(Math.max(0, elapsed - 1) / 7) + 1,
    dayOfWeek: elapsed === 0 ? 0 : ((elapsed - 1) % 7) + 1,
  };
}

function partialWeek(state: WorldState): PartialWeek {
  const d = state.current.days;
  return { daysElapsed: d.length, sold: d.reduce((a, x) => a + x.sold, 0), takingsCp: d.reduce((a, x) => a + x.revenueReportedCp, 0) };
}

function digestFor(world: WorldDefinition, state: WorldState, opts: ViewOptions): Digest | undefined {
  if (opts.digestFromDay === undefined || opts.digestFromDay > state.day - 1) return undefined;
  return buildDigest(world, state, Math.max(state.startDay, opts.digestFromDay), state.day - 1);
}

function period(world: WorldDefinition, state: WorldState) {
  const last = Math.max(state.startDay, state.day - 1);
  return { start: formatDate(dateFromDay(world.calendar, state.startDay), world.calendar), end: formatDate(dateFromDay(world.calendar, last), world.calendar) };
}

export function buildPlayerView(world: WorldDefinition, result: RunResult, opts: ViewOptions = {}): PlayerView {
  const s = result.state;
  const cal = world.calendar;
  const short = (day: number) => formatShortDate(dateFromDay(cal, day));
  const reports = buildAllReports(world, s).map((r) => ({
    week: r.week,
    title: r.title,
    dateRange: r.dateRange,
    // Players get the short version: the summary plus the few lines that matter most.
    lines: r.lines.filter((l) => l.brief !== false).map((l) => ({ section: l.section, tone: l.tone, text: l.text })),
  }));
  return {
    kind: "player",
    notice: SANDBOX_NOTICE,
    status: result.status,
    period: period(world, s),
    business: {
      name: s.plan.name,
      identity: s.plan.identity,
      neighborhood: world.neighborhoods[s.plan.neighborhood]?.name ?? s.plan.neighborhood,
      status: s.business.status,
      cashCp: s.business.cashCp,
      ownerDrawsCp: s.business.ownerDrawsCp,
      licensing: s.business.licensing.status,
      staff: s.business.staff.map((m) => ({ name: m.name, role: m.role, wageCpPerDay: m.wageCpPerDay })),
    },
    plan: s.plan,
    weeks: s.weeks.map((w) => ({
      index: w.index,
      dateRange: `${short(w.startDay)} – ${short(w.endDay)}`,
      produced: w.produced,
      sold: w.sold,
      waste: w.waste,
      revenueCp: w.revenueCp,
      costsCp: w.costsCp,
      profitCp: w.profitCp,
      ownerDrawCp: w.ownerDrawCp,
      cashEndCp: w.cashEndCp,
      ledger: { ...w.ledger },
      festivals: w.festivals,
      weather: w.weather,
    })),
    reports,
    events: s.events
      .filter((e) => e.visibleToPlayers)
      .map((e) => ({
        id: e.id,
        date: short(e.day),
        title: e.title,
        text: e.playerText,
        severity: e.severity,
        resolution: e.resolution?.label,
        decidedBy: e.resolution ? (e.resolution.authority === "players" || e.resolution.authority === "standing-order" ? ("us" as const) : ("others" as const)) : undefined,
      })),
    knowledge: s.knowledge.map((k) => ({ date: short(k.day), topic: k.topic, text: k.text })),
    conditions: s.conditions.filter((c) => c.visibleToPlayers).map((c) => c.label),
    pending: result.pending
      .filter((p) => p.authority === "players")
      .map((p) => ({
        id: p.id,
        prompt: p.prompt,
        dueDate: short(p.dueDay),
        dueDay: p.dueDay,
        dueNow: result.blocking.includes(p.id),
        options: p.options.map((o) => ({ id: o.id, label: o.label, description: o.description })),
      })),
    stoppedOn: result.pausedOnEvent
      ? result.pausedOnEvent.visibleToPlayers
        ? { id: result.pausedOnEvent.id, title: result.pausedOnEvent.title, text: result.pausedOnEvent.playerText, severity: result.pausedOnEvent.severity }
        : { id: result.pausedOnEvent.id, title: "The DM has paused the clock", text: "Something is happening that the DM wants to look at.", severity: "notable" }
      : undefined,
    account: accountView(world, s),
    clock: clock(world, s),
    currentWeek: partialWeek(s),
    digest: (() => {
      const d = digestFor(world, s, opts);
      return d ? { title: d.title, lines: d.lines.map((l) => ({ section: l.section, tone: l.tone, text: l.text })) } : undefined;
    })(),
  };
}

export function buildDmView(world: WorldDefinition, result: RunResult, opts: ViewOptions = {}): DmView {
  const s = result.state;
  const { current, ...rest } = s;
  const { days, ...currentRest } = current;
  return {
    kind: "dm",
    notice: SANDBOX_NOTICE,
    status: result.status,
    period: period(world, s),
    state: { ...rest, current: currentRest },
    reports: buildAllReports(world, s),
    explanations: s.weeks.map((w) => ({ week: w.index, variables: explainWeek(w) })),
    pending: result.pending.map((p) => ({
      ...p,
      optionEffects: Object.fromEntries(p.options.map((o) => [o.id, o.effects.map(describeEffect)])),
      dueDate: formatShortDate(dateFromDay(world.calendar, p.dueDay)),
      dueNow: result.blocking.includes(p.id),
    })),
    pausedOnEvent: result.pausedOnEvent,
    clock: clock(world, s),
    currentWeek: partialWeek(s),
    digest: digestFor(world, s, opts),
    account: accountView(world, s),
    days,
    labels: {
      actors: Object.fromEntries(world.actors.map((a) => [a.id, a.name])),
      threads: Object.fromEntries(world.threads.map((t) => [t.id, { title: t.title, maxProgress: t.maxProgress, stages: t.stages.map((st) => ({ stage: st.stage, title: st.title, threshold: st.threshold })) }])),
      staff: Object.fromEntries(world.staffPool.map((c) => [c.id, { name: c.name, blurb: c.blurb, traits: c.traits }])),
    },
  };
}
