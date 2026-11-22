/**
 * Public catalog for the plan editor: only what players may know. Hidden traits
 * (staff honesty etc.) and numeric neighborhood parameters stay on the server.
 */
import { dateFromDay, formatDate } from "../engine/calendar";
import { formatCp } from "../engine/math";
import type { BusinessPlanInput } from "../engine/plan";
import { arentoria, DEFAULT_START_DAY, scenarios } from "../world";

export interface Catalog {
  startDate: string;
  calendarLabel: string;
  scenarios: { id: string; label: string; summary: string; quality: string; plan: BusinessPlanInput }[];
  neighborhoods: { id: string; name: string; description: string }[];
  unmodelled: string[];
  channels: { type: string; label: string; description: string; role: string }[];
  staff: { id: string; name: string; roles: string[]; blurb: string; askingWageCpPerDay: number; provenance: string }[];
  qualityTiers: { tier: number; label: string; costHint: string }[];
  guild: { associate: string; member: string };
  marketWages: Record<string, number>;
  constructs: { count: number; capacityPerDay: number };
  canon: { id: string; statement: string }[];
}

export function publicCatalog(): Catalog {
  const w = arentoria;
  const a = w.assumptions;
  return {
    startDate: formatDate(dateFromDay(w.calendar, DEFAULT_START_DAY), w.calendar),
    calendarLabel: w.calendar.label,
    scenarios: scenarios.map((s) => ({ id: s.id, label: s.label, summary: s.summary, quality: s.quality, plan: s.plan })),
    neighborhoods: Object.values(w.neighborhoods).map((n) => ({ id: n.id, name: n.name, description: n.description })),
    unmodelled: ["Guildstrand", "Stoneback", "Scholarium", "Crown Ward", "the Shades", "Outer Ward"],
    channels: Object.values(w.channels).map((c) => ({ type: c.type, label: c.label, description: c.description, role: c.staffRole })),
    staff: w.staffPool.map((s) => ({ id: s.id, name: s.name, roles: s.roles, blurb: s.blurb, askingWageCpPerDay: s.askingWageCpPerDay, provenance: s.provenance.status })),
    qualityTiers: a.qualityTiers.map((t) => ({ tier: t.tier, label: t.label, costHint: `~${t.ingredientCostCp} cp ingredients/pie` })),
    guild: {
      associate: `${formatCp(a.guild.associateInitiationCp)} to join, ${formatCp(a.guild.associateDuesCpPerWeek)}/week`,
      member: `${formatCp(a.guild.memberInitiationCp)} to join, ${formatCp(a.guild.memberDuesCpPerWeek)}/week`,
    },
    marketWages: a.marketWageCpPerDay,
    constructs: { count: a.constructs.count, capacityPerDay: a.constructs.count * a.constructs.piesPerDayEach },
    canon: w.canon.map((c) => ({ id: c.id, statement: c.statement })),
  };
}
