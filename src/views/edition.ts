/**
 * A published report ("edition"): the frozen, player-safe record of one stretch of
 * campaign time. Built only from player-visible data (the same allow-list as the
 * player view), so it can be printed, shown to players, or sent to DungeonShare.
 * Once published it is stored as-is and never recomputed.
 */
import { dateFromDay, formatShortDate } from "../engine/calendar";
import { rngFor } from "../engine/rng";
import type { RunResult } from "../engine/simulate";
import type { Notice, WorldDefinition } from "../engine/types";
import { buildCalendarGuide, type CalendarGuide } from "./calendar-guide";
import { buildPlayerView } from "./index";

export interface EditionContent {
  format: 1;
  number: number;
  title: string;
  business: { name: string; identity: string; neighborhood: string; size: string };
  period: { fromDay: number; toDay: number; from: string; to: string; days: number };
  /** Real-world date the DM published it, and the DM's deadline and note (free text). */
  publishedAt: string;
  deadline: string;
  note: string;
  /** "Since last time": the stretch in a few lines. */
  summary: { tone: "good" | "bad" | "neutral"; text: string }[];
  /** Short weekly reports for the weeks that closed in this stretch. */
  reports: { week: number; title: string; dateRange: string; lines: { tone: "good" | "bad" | "neutral"; text: string }[] }[];
  news: { date: string; title: string; text: string; severity: string; resolution?: string }[];
  questions: { id: string; prompt: string; answerBy: string; answerByDay: number; options: { id: string; label: string; description: string }[]; ifNoAnswer: string | null }[];
  strongbox: {
    location: string;
    balanceCp: number;
    safeToWithdrawCp: number;
    floorCp: number;
    status: string;
    withdrawnCp: number;
    depositedCp: number;
    /** When money is short: what's owed, and what gets deliveries going, clears the debt, and leaves a week's cushion. */
    owedCp?: number;
    toResumeCp?: number;
    toClearCp?: number;
    toCushionCp?: number;
    /** What running out of money cost during this stretch. */
    creditSurchargeCp?: number;
    lateWageWeeks?: number;
    entries: { date: string; kind: string; description: string; amountCp: number; balanceCp?: number; by?: string }[];
  };
  totals: { weeks: number; piesSold: number; takingsCp: number; earnedCp: number; withdrawnCp: number };
  weeks: { index: number; dateRange: string; produced: number; sold: number; revenueCp: number; profitCp: number; cashEndCp: number; festivals: string[] }[];
  comingUp: { date: string; text: string; festivalId?: string }[];
  /**
   * Every decision so far (whole campaign, oldest first): what the party chose, or what the
   * manager did when it was left to them. DM-only decisions are never included.
   */
  decisions?: { date: string; title: string; choice: string; by: "party" | "manager" }[];
  /** Where we are in the year: the season guide shown with the report. */
  calendar?: CalendarGuide;
  /** Classified ads: reminders of real options (growing, other districts, hires, services). */
  notices?: Notice[];
  /** The party's standing choices (their own plan; nothing hidden). */
  choices: {
    neighborhood: string;
    size: string;
    outlets: { label: string; sharePct: number }[];
    quality: string;
    priceCp: number;
    piesPerWeek: number;
    daysOpen: number;
    staff: { name: string; role: string; wageCpPerDay: number }[];
    compliance: string;
    guild: string;
    constructs: string;
    precautions: boolean;
    advertisingCpPerWeek: number;
    suppliers: number;
    reserveDays: number;
    /** Not included in new reports: the manager's standing instructions are a DM setting. */
    standingOrders?: Record<string, string>;
  };
}

export interface EditionOptions {
  number: number;
  fromDay: number;
  toDay: number;
  publishedAt: string;
  deadline: string;
  note: string;
}

/** Notices for a report; a festival announced in the notices isn't repeated under "Coming up". */
function withNotices(world: WorldDefinition, result: RunResult, number: number, comingUp: EditionContent["comingUp"]) {
  const s = result.state;
  const notices = world.notices?.({ world, state: s, reportNumber: number, rng: rngFor(s.seed, "notices", number) }) ?? [];
  const announced = new Set(notices.filter((n) => n.kind === "festival" && n.ref).map((n) => n.ref));
  return { comingUp: comingUp.filter((c) => !c.festivalId || !announced.has(c.festivalId)), notices };
}

export function buildEdition(world: WorldDefinition, result: RunResult, o: EditionOptions): EditionContent {
  const s = result.state;
  const view = buildPlayerView(world, result, { digestFromDay: o.fromDay });
  const short = (day: number) => formatShortDate(dateFromDay(world.calendar, day));
  const inPeriod = (day: number) => day >= o.fromDay && day <= o.toDay;
  const weekEnd = new Map(s.weeks.map((w) => [w.index, w.endDay]));
  const by = (a?: string) => (a === "dm" ? "DM" : a === "players" ? "party" : a === "standing-order" ? "standing order" : a === "sandbox-assumption" ? "sandbox assumption" : undefined);
  const plan = s.plan;
  const n = world.neighborhoods[plan.neighborhood];
  const size = world.stages[plan.stage]?.label ?? plan.stage;
  const tier = world.assumptions.qualityTiers.find((t) => t.tier === plan.quality);

  const comingUp: EditionContent["comingUp"] = [];
  for (let d = o.toDay + 1; d <= o.toDay + 28; d++) {
    for (const f of dateFromDay(world.calendar, d).festivals) if (!comingUp.some((c) => c.festivalId === f.id)) comingUp.push({ date: short(d), festivalId: f.id, text: `${f.name}${f.area ? ` (${f.area})` : ""}. ${f.description}` });
  }

  return {
    format: 1,
    number: o.number,
    title: `Report ${o.number}`,
    business: { name: plan.name, identity: plan.identity, neighborhood: n?.name ?? plan.neighborhood, size },
    period: { fromDay: o.fromDay, toDay: o.toDay, from: short(o.fromDay), to: short(o.toDay), days: o.toDay - o.fromDay + 1 },
    publishedAt: o.publishedAt,
    deadline: o.deadline,
    note: o.note,
    summary: (view.digest?.lines ?? []).map((l) => ({ tone: l.tone, text: l.text })),
    reports: view.reports
      .filter((r) => inPeriod(weekEnd.get(r.week) ?? -1))
      .map((r) => ({ week: r.week, title: r.title, dateRange: r.dateRange, lines: r.lines.map((l) => ({ tone: l.tone, text: l.text })) })),
    news: s.events
      .filter((e) => e.visibleToPlayers && inPeriod(e.day))
      .map((e) => ({ date: short(e.day), title: e.title, text: e.playerText, severity: e.severity, ...(e.resolution ? { resolution: e.resolution.label } : {}) })),
    questions: result.pending
      .filter((p) => p.authority === "players")
      .map((p) => ({
        id: p.id,
        prompt: p.prompt,
        answerBy: short(p.dueDay),
        answerByDay: p.dueDay,
        options: p.options.map((x) => ({ id: x.id, label: x.label, description: x.description })),
        ifNoAnswer: p.options.find((x) => x.id === p.defaultOptionId)?.label ?? null,
      })),
    strongbox: {
      location: view.account.location,
      balanceCp: view.account.balanceCp,
      safeToWithdrawCp: view.account.safeToWithdrawCp,
      floorCp: view.account.floorCp,
      status: view.account.status,
      withdrawnCp: view.account.withdrawnCp,
      depositedCp: view.account.depositedCp,
      owedCp: view.account.owedCp,
      toResumeCp: view.account.toResumeCp,
      toClearCp: view.account.toClearCp,
      toCushionCp: view.account.toCushionCp,
      creditSurchargeCp: s.weeks.filter((w) => inPeriod(w.endDay)).reduce((a, w) => a + (w.creditSurchargeCp ?? 0), 0),
      lateWageWeeks: s.weeks.filter((w) => inPeriod(w.endDay) && w.wagesLate).length,
      entries: s.business.account.statement
        .filter((e) => inPeriod(e.day))
        .map((e) => ({ date: short(e.day), kind: e.kind, description: e.description, amountCp: e.amountCp, ...(e.balanceCp !== undefined ? { balanceCp: e.balanceCp } : {}), ...(by(e.authority) ? { by: by(e.authority) } : {}) })),
    },
    totals: {
      weeks: s.weeks.length,
      piesSold: s.weeks.reduce((a, w) => a + w.sold, 0),
      takingsCp: s.weeks.reduce((a, w) => a + w.revenueCp, 0),
      earnedCp: s.weeks.reduce((a, w) => a + w.profitCp, 0),
      withdrawnCp: s.business.account.withdrawnCp,
    },
    weeks: view.weeks.map((w) => ({ index: w.index, dateRange: w.dateRange, produced: w.produced, sold: w.sold, revenueCp: w.revenueCp, profitCp: w.profitCp, cashEndCp: w.cashEndCp, festivals: w.festivals })),
    decisions: s.events
      .filter((e) => e.visibleToPlayers && e.resolution && (e.resolution.authority === "players" || e.resolution.authority === "standing-order"))
      .map((e) => ({ date: short(e.day), title: e.title, choice: e.resolution!.label, by: e.resolution!.authority === "players" ? ("party" as const) : ("manager" as const) })),
    ...withNotices(world, result, o.number, comingUp),
    calendar: buildCalendarGuide(world, o.fromDay, o.toDay),
    choices: {
      neighborhood: n?.name ?? plan.neighborhood,
      size,
      outlets: plan.channels.filter((c) => c.share > 0).map((c) => ({ label: world.channels[c.type].label, sharePct: Math.round(c.share * 100) })),
      quality: tier ? `${tier.tier}. ${tier.label}` : String(plan.quality),
      priceCp: plan.priceCp,
      piesPerWeek: plan.weeklyProduction,
      daysOpen: plan.operatingDays,
      staff: view.business.staff,
      compliance: plan.compliance,
      guild: plan.guild,
      constructs: `${plan.constructWorkload === "pushed" ? "pushed" : "steady"}, ${plan.constructPublicity}`,
      precautions: plan.security.precautions,
      advertisingCpPerWeek: plan.advertisingCpPerWeek,
      suppliers: plan.suppliers,
      reserveDays: plan.reserveDays,
    },
  };
}
