import { operatesOn } from "../../engine/economy";
import { clamp01 } from "../../engine/math";
import type { Driver, EventContext } from "../../engine/types";

export { formatCp } from "../../engine/math";

export function isOperatingDay(ctx: EventContext): boolean {
  return ctx.state.business.status === "operating" && operatesOn(ctx.world, ctx.plan, ctx.date);
}

export function avgWeeklyRevenue(ctx: EventContext, weeks = 3): number {
  const recent = ctx.state.weeks.slice(-weeks);
  if (!recent.length) return 0;
  return recent.reduce((a, w) => a + w.revenueCp, 0) / recent.length;
}

export function securityMitigation(ctx: EventContext): { value: number; drivers: Driver[] } {
  const guards = ctx.state.business.staff.filter((s) => s.role === "guard").length;
  const drivers: Driver[] = [];
  let m = 0;
  if (ctx.plan.security.precautions) {
    m += 0.3;
    drivers.push({ label: "Precautions", value: -0.3 });
  }
  if (guards) {
    m += 0.5 * guards;
    drivers.push({ label: `Guard${guards > 1 ? "s" : ""} on duty`, value: -0.5 * guards });
  }
  return { value: clamp01(Math.min(0.85, m)), drivers };
}

export function vendors(ctx: EventContext) {
  return ctx.state.business.staff.filter((s) => s.role === "vendor" || s.role === "runner");
}

export const pct = (p: number) => `${Math.round(p * 1000) / 10}%`;
