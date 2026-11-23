/**
 * Public catalog for the plan editor: only what players may know. Hidden traits
 * (staff honesty etc.) and numeric neighborhood parameters stay on the server.
 */
import { dateFromDay, formatDate } from "../engine/calendar";
import { fairPrice } from "../engine/economy";
import { formatCp } from "../engine/math";
import type { BusinessPlanInput } from "../engine/plan";
import { arentoria, DEFAULT_START_DAY, scenarios } from "../world";
import { unmodelledNeighborhoods } from "../world/neighborhoods";

export interface Catalog {
  startDate: string;
  calendarLabel: string;
  scenarios: { id: string; label: string; summary: string; quality: string; plan: BusinessPlanInput }[];
  /** Districts, with the going rate for a pie at each quality tier and a note if carts struggle there. */
  neighborhoods: { id: string; name: string; description: string; goingRateCp: Record<number, number>; cartNote: string | null }[];
  unmodelled: string[];
  /** Business sizes (the DM's guard rails) and their limits. */
  stages: {
    id: string;
    label: string;
    description: string;
    outlets?: Record<string, number>;
    maxStaff?: number;
    roles?: string[];
    maxWeeklyProduction?: number;
    allowPushedWorkload: boolean;
    allowFestivalPush: boolean;
  }[];
  channels: { type: string; label: string; description: string; role: string }[];
  staff: { id: string; name: string; roles: string[]; blurb: string; askingWageCpPerDay: number; provenance: string }[];
  qualityTiers: { tier: number; label: string; costHint: string }[];
  guild: { associate: string; member: string };
  marketWages: Record<string, number>;
  constructs: { count: number; capacityPerDay: number; pushedMultiplier: number };
  canon: { id: string; statement: string }[];
}

export function publicCatalog(): Catalog {
  const w = arentoria;
  const a = w.assumptions;
  return {
    startDate: formatDate(dateFromDay(w.calendar, DEFAULT_START_DAY), w.calendar),
    calendarLabel: w.calendar.label,
    scenarios: scenarios.map((s) => ({ id: s.id, label: s.label, summary: s.summary, quality: s.quality, plan: s.plan })),
    neighborhoods: Object.values(w.neighborhoods).map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      goingRateCp: Object.fromEntries(a.qualityTiers.map((t) => [t.tier, Math.round(fairPrice(w, n, t.tier))])),
      cartNote: n.channelFit.cart < 0.6 ? `Few people in ${n.name} buy from a street cart, so a cart alone will struggle here.` : null,
    })),
    unmodelled: unmodelledNeighborhoods,
    stages: Object.values(w.stages).map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      ...(s.outlets ? { outlets: s.outlets as Record<string, number> } : {}),
      ...(s.maxStaff !== undefined ? { maxStaff: s.maxStaff } : {}),
      ...(s.roles ? { roles: s.roles } : {}),
      ...(s.maxWeeklyProduction !== undefined ? { maxWeeklyProduction: s.maxWeeklyProduction } : {}),
      allowPushedWorkload: s.allowPushedWorkload,
      allowFestivalPush: s.allowFestivalPush,
    })),
    channels: Object.values(w.channels).map((c) => ({ type: c.type, label: c.label, description: c.description, role: c.staffRole })),
    staff: w.staffPool.map((s) => ({ id: s.id, name: s.name, roles: s.roles, blurb: s.blurb, askingWageCpPerDay: s.askingWageCpPerDay, provenance: s.provenance.status })),
    qualityTiers: a.qualityTiers.map((t) => ({ tier: t.tier, label: t.label, costHint: `~${t.ingredientCostCp} cp ingredients/pie` })),
    guild: {
      associate: `${formatCp(a.guild.associateInitiationCp)} to join, ${formatCp(a.guild.associateDuesCpPerWeek)}/week`,
      member: `${formatCp(a.guild.memberInitiationCp)} to join, ${formatCp(a.guild.memberDuesCpPerWeek)}/week`,
    },
    marketWages: a.marketWageCpPerDay,
    constructs: { count: a.constructs.count, capacityPerDay: a.constructs.count * a.constructs.piesPerDayEach, pushedMultiplier: a.constructs.pushedCapacityMultiplier },
    canon: w.canon.map((c) => ({ id: c.id, statement: c.statement })),
  };
}
