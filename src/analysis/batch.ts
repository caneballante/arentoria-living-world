/**
 * Scenario analysis: repeated seeded runs, outcome metrics and strategy comparison.
 *
 * Because random streams are keyed by (seed, context), run i of every scenario sees
 * the same weather and the same "dice" for each event check. Paired comparisons
 * across scenarios therefore isolate the effect of the plan.
 */
import { mean, percentile } from "../engine/math";
import type { BusinessPlanInput } from "../engine/plan";
import { simulateScenario } from "../engine/simulate";
import type { WorldDefinition, WorldState } from "../engine/types";

export type EndState = "failing" | "under-pressure" | "thriving" | "profitable" | "struggling";

export interface RunMetrics {
  scenarioId: string;
  seed: string;
  weeks: number;
  totalProfitCp: number;
  meanWeeklyProfitCp: number;
  lateWeeklyProfitCp: number;
  ownerDrawsCp: number;
  endingCashCp: number;
  minCashCp: number;
  lossWeeks: number;
  wasteRate: number;
  endReputation: number;
  avgReputation: number;
  peakCriminalAttention: number;
  peakScrutiny: number;
  peakRivalHostility: number;
  adverseEvents: number;
  majorEvents: number;
  opportunities: number;
  suspendedDays: number;
  threadPeaks: Record<string, number>;
  endState: EndState;
  /** Pacing (per run): decisions put to the players / DM, report-worthy and major events. */
  playerDecisions: number;
  dmDecisions: number;
  notableEvents: number;
  /** All major events, including scheduled rulings. */
  majorMoments: number;
  /** Longest run of consecutive weeks with nothing notable or major. */
  longestQuietWeeks: number;
  /** Most times any single thread stage was entered (loop detector). */
  maxStageRepeats: number;
}

export function classifyEndState(state: WorldState): EndState {
  const w = state.weeks;
  const late = w.slice(-8);
  const lateProfit = late.length ? mean(late.map((x) => x.profitCp)) : 0;
  if (state.business.cashCp < 0 || state.business.status === "closed") return "failing";
  if (Object.values(state.threads).some((t) => t.stage >= 3)) return "under-pressure";
  if (lateProfit >= 1500 && state.business.hidden.reputation >= 55) return "thriving";
  if (lateProfit > 0) return "profitable";
  return "struggling";
}

export function isAdverse(e: WorldState["events"][number]): boolean {
  return e.severity !== "minor" && e.category !== "opportunity" && !e.eventId.includes("recede") && e.eventId !== "construct-license-decision" && !(e.eventId === "inspection:stage-2" && e.severity === "notable");
}

export function metricsFor(scenarioId: string, seed: string, state: WorldState): RunMetrics {
  const w = state.weeks;
  const produced = w.reduce((a, x) => a + x.produced, 0);
  const waste = w.reduce((a, x) => a + x.waste, 0);
  const late = w.slice(-8);
  return {
    scenarioId,
    seed,
    weeks: w.length,
    totalProfitCp: w.reduce((a, x) => a + x.profitCp, 0),
    meanWeeklyProfitCp: mean(w.map((x) => x.profitCp)),
    lateWeeklyProfitCp: late.length ? mean(late.map((x) => x.profitCp)) : 0,
    ownerDrawsCp: state.business.ownerDrawsCp,
    endingCashCp: state.business.cashCp,
    minCashCp: state.business.minCashCp,
    lossWeeks: w.filter((x) => x.profitCp < 0).length,
    wasteRate: produced ? waste / produced : 0,
    endReputation: state.business.hidden.reputation,
    avgReputation: mean(w.map((x) => x.hiddenEnd.reputation)),
    peakCriminalAttention: Math.max(0, ...w.map((x) => x.hiddenEnd.criminalAttention)),
    peakScrutiny: Math.max(0, ...w.map((x) => x.hiddenEnd.scrutiny)),
    peakRivalHostility: Math.max(0, ...w.map((x) => x.hiddenEnd.rivalHostility)),
    adverseEvents: state.events.filter(isAdverse).length,
    majorEvents: state.events.filter((e) => e.severity === "major" && e.eventId !== "construct-license-decision").length,
    opportunities: state.events.filter((e) => e.category === "opportunity").length,
    suspendedDays: state.history.flatMap((h) => h.effects).reduce((a, e) => a + (e.kind === "suspend" ? e.days : 0), 0),
    threadPeaks: Object.fromEntries(Object.values(state.threads).map((t) => [t.id, t.peakStage])),
    endState: classifyEndState(state),
    ...pacingMetrics(state),
  };
}

export function pacingMetrics(state: WorldState) {
  const decisions = state.events.filter((e) => e.decisionId);
  const isDmDecision = (e: WorldState["events"][number]) => state.history.some((h) => h.cause.kind === "decision" && h.cause.refId === e.decisionId && (h.authority === "dm" || h.authority === "sandbox-assumption"));
  const busy = new Set(state.events.filter((e) => e.severity !== "minor").map((e) => e.week));
  let longest = 0;
  let run = 0;
  for (let w = 1; w <= state.weeks.length; w++) {
    run = busy.has(w) ? 0 : run + 1;
    longest = Math.max(longest, run);
  }
  const stageCounts = new Map<string, number>();
  for (const e of state.events) if (e.threadId && e.stage !== undefined && e.eventId.includes(":stage-")) stageCounts.set(e.eventId, (stageCounts.get(e.eventId) ?? 0) + 1);
  const dmDecisions = decisions.filter(isDmDecision).length;
  return {
    playerDecisions: decisions.length - dmDecisions,
    dmDecisions,
    notableEvents: state.events.filter((e) => e.severity === "notable").length,
    majorMoments: state.events.filter((e) => e.severity === "major").length,
    longestQuietWeeks: longest,
    maxStageRepeats: Math.max(0, ...stageCounts.values()),
  };
}

export interface BatchScenario {
  id: string;
  label: string;
  plan: BusinessPlanInput;
}

export interface Distribution {
  mean: number;
  p10: number;
  p50: number;
  p90: number;
}

const dist = (xs: number[]): Distribution => ({ mean: mean(xs), p10: percentile(xs, 0.1), p50: percentile(xs, 0.5), p90: percentile(xs, 0.9) });

export interface ScenarioSummary {
  scenarioId: string;
  label: string;
  runs: number;
  weeks: number;
  totalProfitCp: Distribution;
  ownerDrawsCp: Distribution;
  minCashCp: Distribution;
  endReputation: Distribution;
  lossWeeks: Distribution;
  wasteRate: Distribution;
  adverseEvents: Distribution;
  playerDecisions: Distribution;
  dmDecisions: Distribution;
  notableEvents: Distribution;
  majorMoments: Distribution;
  longestQuietWeeks: Distribution;
  maxStageRepeats: Distribution;
  /** Share of runs ending with total profit below zero. */
  pNetLoss: number;
  /** Share of runs in which cash ever went negative. */
  pCashNegative: number;
  /** P(thread reached at least stage k), per thread. */
  threadReach: Record<string, Record<number, number>>;
  endStates: Partial<Record<EndState, number>>;
}

export function summarize(label: string, scenarioId: string, runs: RunMetrics[]): ScenarioSummary {
  const n = runs.length || 1;
  const threadIds = Object.keys(runs[0]?.threadPeaks ?? {});
  const threadReach: ScenarioSummary["threadReach"] = {};
  for (const id of threadIds) {
    threadReach[id] = {};
    for (const k of [1, 2, 3, 4]) threadReach[id]![k] = runs.filter((r) => (r.threadPeaks[id] ?? 0) >= k).length / n;
  }
  const endStates: ScenarioSummary["endStates"] = {};
  for (const r of runs) endStates[r.endState] = (endStates[r.endState] ?? 0) + 1 / n;
  return {
    scenarioId,
    label,
    runs: runs.length,
    weeks: runs[0]?.weeks ?? 0,
    totalProfitCp: dist(runs.map((r) => r.totalProfitCp)),
    ownerDrawsCp: dist(runs.map((r) => r.ownerDrawsCp)),
    minCashCp: dist(runs.map((r) => r.minCashCp)),
    endReputation: dist(runs.map((r) => r.endReputation)),
    lossWeeks: dist(runs.map((r) => r.lossWeeks)),
    wasteRate: dist(runs.map((r) => r.wasteRate)),
    adverseEvents: dist(runs.map((r) => r.adverseEvents)),
    playerDecisions: dist(runs.map((r) => r.playerDecisions)),
    dmDecisions: dist(runs.map((r) => r.dmDecisions)),
    notableEvents: dist(runs.map((r) => r.notableEvents)),
    majorMoments: dist(runs.map((r) => r.majorMoments)),
    longestQuietWeeks: dist(runs.map((r) => r.longestQuietWeeks)),
    maxStageRepeats: dist(runs.map((r) => r.maxStageRepeats)),
    pNetLoss: runs.filter((r) => r.totalProfitCp < 0).length / n,
    pCashNegative: runs.filter((r) => r.minCashCp < 0).length / n,
    threadReach,
    endStates,
  };
}

export interface BatchOptions {
  runs: number;
  weeks: number;
  startDay: number;
  seedPrefix?: string;
}

export interface BatchResult {
  options: BatchOptions;
  summaries: ScenarioSummary[];
  runs: Record<string, RunMetrics[]>;
}

export function seedFor(prefix: string, i: number): string {
  return `${prefix}-${String(i).padStart(3, "0")}`;
}

export function runBatch(world: WorldDefinition, scenarios: BatchScenario[], options: BatchOptions): BatchResult {
  const prefix = options.seedPrefix ?? "batch";
  const runs: Record<string, RunMetrics[]> = {};
  for (const sc of scenarios) {
    runs[sc.id] = [];
    for (let i = 0; i < options.runs; i++) {
      const seed = seedFor(prefix, i);
      const result = simulateScenario(world, { plan: sc.plan, seed, weeks: options.weeks, startDay: options.startDay });
      runs[sc.id]!.push(metricsFor(sc.id, seed, result.state));
    }
  }
  return { options, runs, summaries: scenarios.map((sc) => summarize(sc.label, sc.id, runs[sc.id]!)) };
}

/** Share of paired seeds in which scenario A's metric beats scenario B's. */
export function pairedWinRate(a: RunMetrics[], b: RunMetrics[], metric: (r: RunMetrics) => number = (r) => r.totalProfitCp): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let wins = 0;
  for (let i = 0; i < n; i++) if (metric(a[i]!) > metric(b[i]!)) wins++;
  return wins / n;
}
