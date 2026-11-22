/**
 * "Since last time" digest: a short summary of any stretch of in-game time — one day,
 * one week, or a long downtime — so the party sees the arc of results at a glance.
 * Like weekly reports, every line has a DM-only basis; players get the text only.
 */
import { dateFromDay, formatShortDate } from "../engine/calendar";
import { formatCp, round } from "../engine/math";
import type { HiddenState, WorldDefinition, WorldState } from "../engine/types";
import type { ReportLine } from "./weekly-report";

export interface Digest {
  fromDay: number;
  toDay: number;
  days: number;
  title: string;
  lines: ReportLine[];
}

function trendWord(delta: number, up: string, down: string, flat: string): string {
  if (delta >= 4) return up;
  if (delta <= -4) return down;
  return flat;
}

/** Cash at the end of a given absolute day, reconstructed from week records and day records. */
function cashAt(state: WorldState, day: number): number {
  const before = state.weeks.filter((w) => w.endDay <= day);
  const lastWeek = before[before.length - 1];
  if (lastWeek && lastWeek.endDay === day) return lastWeek.cashEndCp;
  // Inside an unfinished week: no daily cash snapshots are kept, so use the latest known figure.
  if (state.current.startDay <= day && day < state.day) return state.business.cashCp;
  return lastWeek ? lastWeek.cashEndCp : state.plan.startingCapitalCp;
}

function hiddenAt(state: WorldState, day: number): HiddenState {
  const before = state.weeks.filter((w) => w.endDay <= day);
  return before.length ? before[before.length - 1]!.hiddenEnd : state.weeks[0]?.hiddenStart ?? state.business.hidden;
}

export function buildDigest(world: WorldDefinition, state: WorldState, fromDay: number, toDay: number): Digest {
  const cal = world.calendar;
  const short = (d: number) => formatShortDate(dateFromDay(cal, d));
  const days = Math.max(0, toDay - fromDay + 1);
  const lines: ReportLine[] = [];
  const add = (section: ReportLine["section"], tone: ReportLine["tone"], text: string, basis: string) => lines.push({ section, tone, text, basis });

  // Sales and money over the period: completed weeks inside the range plus days of the current week.
  const weeks = state.weeks.filter((w) => w.startDay >= fromDay && w.endDay <= toDay);
  const partialDays = state.current.days.filter((d) => d.day >= fromDay && d.day <= toDay);
  const sold = weeks.reduce((a, w) => a + w.sold, 0) + partialDays.reduce((a, d) => a + d.sold, 0);
  const takings = weeks.reduce((a, w) => a + w.revenueCp, 0) + partialDays.reduce((a, d) => a + d.revenueReportedCp, 0);
  const profit = weeks.reduce((a, w) => a + w.profitCp, 0);
  const draws = weeks.reduce((a, w) => a + w.ownerDrawCp, 0);
  const cashBefore = fromDay <= state.startDay ? state.plan.startingCapitalCp : cashAt(state, fromDay - 1);
  const cashNow = state.business.cashCp;
  const span = days === 1 ? `on ${short(fromDay)}` : `from ${short(fromDay)} to ${short(toDay)} (${days} days)`;
  add(
    "summary",
    profit >= 0 ? "good" : "bad",
    `${span[0]!.toUpperCase()}${span.slice(1)}: sold ${sold.toLocaleString()} pies for ${formatCp(takings)} in takings.${weeks.length ? ` Over the ${weeks.length} completed week(s), profit was ${formatCp(profit)}${draws ? ` and the party was paid ${formatCp(draws)}` : ""}.` : ""} Cash on hand ${formatCp(cashNow)} (was ${formatCp(cashBefore)}).`,
    `Ledger over the period. Partial-week days count toward sales and takings only; costs settle at week end.`,
  );

  // Qualitative trends players could sense.
  if (weeks.length >= 1) {
    const h0 = hiddenAt(state, fromDay - 1);
    const h1 = state.weeks.length ? state.weeks[state.weeks.length - 1]!.hiddenEnd : state.business.hidden;
    const dRep = h1.reputation - h0.reputation;
    const dVis = h1.visibility - h0.visibility;
    add("customers", dRep >= 4 ? "good" : dRep <= -4 ? "bad" : "neutral", trendWord(dRep, "Word about our pies has improved.", "Word about our pies has soured.", "Customers' opinion of us has held steady."), `Reputation ${round(h0.reputation, 0)} → ${round(h1.reputation, 0)}.`);
    if (Math.abs(dVis) >= 4) add("street", dVis > 0 ? "good" : "neutral", trendWord(dVis, "More people know who we are.", "Fewer people seem to notice us than before.", ""), `Visibility ${round(h0.visibility, 0)} → ${round(h1.visibility, 0)}.`);
  }

  // What happened, in order.
  const events = state.events.filter((e) => e.day >= fromDay && e.day <= toDay && e.visibleToPlayers && e.severity !== "minor");
  for (const e of events) {
    const byUs = e.resolution && (e.resolution.authority === "players" || e.resolution.authority === "standing-order");
    const tail = e.resolution ? ` ${byUs ? "We decided" : "Outcome"}: ${e.resolution.label}.` : "";
    add("events", e.category === "opportunity" ? "good" : e.severity === "major" ? "bad" : "neutral", `${short(e.day)} — ${e.playerText}${tail}`, `${e.title}${e.probability !== undefined ? ` (p=${e.probability})` : ""}. ${e.dmText}`);
  }
  const minor = state.events.filter((e) => e.day >= fromDay && e.day <= toDay && e.visibleToPlayers && e.severity === "minor").length;
  if (minor) add("events", "neutral", `Plus ${minor} small happening(s) — see the weekly reports.`, "Minor events (absences, small thefts, crowds…).");

  // Still waiting on us.
  for (const p of state.pending.filter((x) => x.authority === "players")) {
    add("events", "neutral", `Waiting on us: ${p.prompt} (answer by ${short(p.dueDay)}).`, `Pending decision ${p.id}; standing order applies if unanswered.`);
  }
  for (const c of state.conditions.filter((x) => x.visibleToPlayers && x.id.startsWith("awaiting-session"))) {
    add("events", "neutral", `To settle at the table: ${c.label}.`, "Flagged for in-person play.");
  }

  return { fromDay, toDay, days, title: days >= 7 ? `Since last time — ${days} days` : `Since last time`, lines };
}
