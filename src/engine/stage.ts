/** Business sizes: checks a plan against the DM's guard rails for its size. */
import type { BusinessPlan } from "./plan";
import type { WorldDefinition } from "./types";

/** Everything about a plan that is bigger than its business size allows (plain sentences). */
export function stageViolations(world: WorldDefinition, plan: BusinessPlan): string[] {
  const stage = world.stages[plan.stage];
  if (!stage) return [`Unknown business size "${plan.stage}"`];
  const out: string[] = [];
  const name = stage.label;
  if (stage.outlets) {
    const used = plan.channels.filter((c) => c.share > 0);
    for (const type of new Set(used.map((c) => c.type))) {
      const allowed = stage.outlets[type] ?? 0;
      const count = used.filter((c) => c.type === type).length;
      const label = world.channels[type].label.toLowerCase();
      if (allowed === 0) out.push(`${name} doesn't allow a ${label} yet.`);
      else if (count > allowed) out.push(`${name} allows ${allowed} ${label}${allowed > 1 ? "s" : ""}, not ${count}.`);
    }
  }
  if (stage.maxStaff !== undefined && plan.staff.length > stage.maxStaff) out.push(`${name} allows ${stage.maxStaff} hire${stage.maxStaff === 1 ? "" : "s"}, not ${plan.staff.length}.`);
  if (stage.roles) for (const s of plan.staff) if (!stage.roles.includes(s.role)) out.push(`${name} doesn't allow hiring a ${s.role} yet.`);
  if (stage.maxWeeklyProduction !== undefined && plan.weeklyProduction > stage.maxWeeklyProduction) out.push(`${name} allows up to ${stage.maxWeeklyProduction} pies a week, not ${plan.weeklyProduction}.`);
  if (!stage.allowPushedWorkload && plan.constructWorkload === "pushed") out.push(`${name} doesn't allow pushing the constructs yet.`);
  if (!stage.allowFestivalPush && plan.festivalProductionMultiplier > 1) out.push(`${name} doesn't allow extra festival-day baking yet.`);
  return out;
}
