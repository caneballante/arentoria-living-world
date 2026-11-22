import type { BusinessPlanInput } from "../src/engine/plan";
import { simulateScenario, type PauseMode } from "../src/engine/simulate";
import type { PendingDecision } from "../src/engine/types";
import { arentoria, DEFAULT_START_DAY, getScenario } from "../src/world";

export const world = arentoria;
export const START = DEFAULT_START_DAY;

export function planOf(id: string, patch: Partial<BusinessPlanInput> = {}): BusinessPlanInput {
  return { ...structuredClone(getScenario(id).plan), ...patch } as BusinessPlanInput;
}

export function run(planOrId: string | BusinessPlanInput, seed = "test-seed", weeks = 26, pause: PauseMode = "never") {
  const plan = typeof planOrId === "string" ? planOf(planOrId) : planOrId;
  return simulateScenario(world, { plan, seed, weeks, startDay: START, pause });
}

/**
 * Replay a run with "pause for decisions", answering every blocking decision with its
 * default option, until a blocking decision matching `match` appears.
 */
export function stepToDecision(planOrId: string | BusinessPlanInput, seed: string, weeks: number, match: (p: PendingDecision) => boolean) {
  const plan = typeof planOrId === "string" ? planOf(planOrId) : planOrId;
  const resolutions: Record<string, string> = {};
  for (let i = 0; i < 60; i++) {
    const result = simulateScenario(world, { plan, seed, weeks, startDay: START, pause: "decisions", resolutions });
    if (result.status === "completed") return { result, resolutions, decision: undefined };
    const blocking = result.pending.filter((p) => result.blocking.includes(p.id));
    const hit = blocking.find(match);
    if (hit) return { result, resolutions, decision: hit };
    for (const p of blocking) resolutions[p.id] = p.defaultOptionId;
  }
  throw new Error("too many pauses");
}
