/**
 * View models. The server builds one of these from a simulation result; clients only
 * ever receive a view, never raw state. The player view is constructed by explicit
 * allow-listing (not by deleting fields), so hidden variables cannot leak by accident.
 */
import { dateFromDay, formatDate, formatShortDate } from "../engine/calendar";
import { describeEffect } from "../engine/effects";
import type { BusinessPlan } from "../engine/plan";
import type { RunResult } from "../engine/simulate";
import type { EventRecord, PendingDecision, WeekRecord, WorldDefinition, WorldState } from "../engine/types";
import { buildAllReports, explainWeek, type ReportLine } from "../narrative/weekly-report";

export const SANDBOX_NOTICE = "Sandbox simulation — provisional results, not campaign canon. Nothing here changes the campaign until the DM approves it.";

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
  pending: { id: string; prompt: string; options: { id: string; label: string; description: string }[] }[];
}

export interface DmView {
  kind: "dm";
  notice: string;
  status: RunResult["status"];
  period: { start: string; end: string };
  state: Omit<WorldState, "current"> & { current: Omit<WorldState["current"], "days"> };
  reports: ReturnType<typeof buildAllReports>;
  explanations: { week: number; variables: ReturnType<typeof explainWeek> }[];
  pending: (PendingDecision & { optionEffects: Record<string, string[]> })[];
  pausedOnEvent?: EventRecord;
  days: WorldState["current"]["days"];
  labels: {
    actors: Record<string, string>;
    threads: Record<string, { title: string; maxProgress: number; stages: { stage: number; title: string; threshold: number }[] }>;
    staff: Record<string, { name: string; blurb: string; traits: { competence: number; honesty: number; reliability: number } }>;
  };
}

function period(world: WorldDefinition, state: WorldState) {
  const last = Math.max(state.startDay, state.day - 1);
  return { start: formatDate(dateFromDay(world.calendar, state.startDay), world.calendar), end: formatDate(dateFromDay(world.calendar, last), world.calendar) };
}

export function buildPlayerView(world: WorldDefinition, result: RunResult): PlayerView {
  const s = result.state;
  const cal = world.calendar;
  const short = (day: number) => formatShortDate(dateFromDay(cal, day));
  const reports = buildAllReports(world, s).map((r) => ({
    week: r.week,
    title: r.title,
    dateRange: r.dateRange,
    lines: r.lines.map((l) => ({ section: l.section, tone: l.tone, text: l.text })),
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
      .map((p) => ({ id: p.id, prompt: p.prompt, options: p.options.map((o) => ({ id: o.id, label: o.label, description: o.description })) })),
  };
}

export function buildDmView(world: WorldDefinition, result: RunResult): DmView {
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
    pending: result.pending.map((p) => ({ ...p, optionEffects: Object.fromEntries(p.options.map((o) => [o.id, o.effects.map(describeEffect)])) })),
    pausedOnEvent: result.pausedOnEvent,
    days,
    labels: {
      actors: Object.fromEntries(world.actors.map((a) => [a.id, a.name])),
      threads: Object.fromEntries(world.threads.map((t) => [t.id, { title: t.title, maxProgress: t.maxProgress, stages: t.stages.map((st) => ({ stage: st.stage, title: st.title, threshold: st.threshold })) }])),
      staff: Object.fromEntries(world.staffPool.map((c) => [c.id, { name: c.name, blurb: c.blurb, traits: c.traits }])),
    },
  };
}
