import type { BusinessPlanInput } from "../src/engine/plan";
import { simulateScenario, type PauseMode } from "../src/engine/simulate";
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
