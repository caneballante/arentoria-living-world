import { NextResponse } from "next/server";
import { z } from "zod";
import { safeParsePlan, type BusinessPlan } from "@/engine/plan";
import { checkPlan, simulateScenario, type ScheduledIntervention } from "@/engine/simulate";
import { resolveRole } from "@/server/access";
import { buildDmView, buildPlayerView } from "@/views";
import { arentoria, DEFAULT_START_DAY } from "@/world";

const MAX_DAYS = 104 * 7;

/**
 * Stateless, deterministic replay: the client sends the starting plan, the seed, the
 * point the clock should reach, the decisions made so far and any plan revisions (by
 * day). The server re-simulates from the start and returns a role-appropriate view.
 * Hidden state never has to be stored in the browser.
 */
const Body = z.object({
  plan: z.unknown(),
  seed: z.string().trim().min(1).max(80),
  /** Total days to simulate from the start (preferred). */
  days: z.number().int().min(1).max(MAX_DAYS).optional(),
  /** Legacy: total weeks. */
  weeks: z.number().int().min(1).max(104).optional(),
  pause: z.enum(["never", "decisions", "decisions-and-major"]).default("never"),
  resolutions: z.record(z.string(), z.string()).default({}),
  acknowledged: z.array(z.string()).default([]),
  /** Plan revisions made between sessions, applied at the start of day `dayOffset` (0 = first day). */
  planChanges: z.array(z.object({ dayOffset: z.number().int().min(1).max(MAX_DAYS), plan: z.unknown() })).max(100).default([]),
  /** Advance until something needs the party: stop on decisions/major events after this day offset. */
  stopWhenNeededFromOffset: z.number().int().min(0).max(MAX_DAYS).optional(),
  /** Build a "since last time" digest from this day offset. */
  digestFromOffset: z.number().int().min(0).max(MAX_DAYS).optional(),
  view: z.enum(["dm", "player"]).default("dm"),
  sandbox: z.object({ licensingOutcome: z.enum(["approve", "delay", "deny"]), inspectionRulings: z.enum(["uphold", "lenient"]) }).partial().default({}),
});

type Issue = { path: string; message: string };

function validatePlan(input: unknown, label: string): { plan?: BusinessPlan; issues: Issue[]; warnings: string[] } {
  const parsed = safeParsePlan(input);
  if (!parsed.success) return { issues: parsed.error.issues.map((i) => ({ path: `${label}${i.path.length ? "." + i.path.join(".") : ""}`, message: i.message })), warnings: [] };
  const check = checkPlan(arentoria, parsed.data);
  return { plan: parsed.data, issues: check.errors.map((m) => ({ path: label, message: m })), warnings: check.warnings };
}

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request", issues: body.error.issues }, { status: 400 });
  const b = body.data;

  const base = validatePlan(b.plan, "plan");
  if (!base.plan || base.issues.length) return NextResponse.json({ error: "Invalid business plan", issues: base.issues }, { status: 400 });
  const interventions: ScheduledIntervention[] = [];
  let warnings = base.warnings;
  for (const [i, change] of b.planChanges.entries()) {
    const v = validatePlan(change.plan, `planChanges[${i}]`);
    if (!v.plan || v.issues.length) return NextResponse.json({ error: "Invalid revised plan", issues: v.issues }, { status: 400 });
    warnings = v.warnings;
    interventions.push({
      day: DEFAULT_START_DAY + change.dayOffset,
      authority: "players",
      description: "Business plan revised between sessions",
      refId: `plan-change-${i + 1}`,
      effects: [{ kind: "plan", patch: v.plan, note: "Plan revised" }],
    });
  }

  const days = b.days ?? (b.weeks ?? 26) * 7;
  const result = simulateScenario(arentoria, {
    plan: base.plan,
    seed: b.seed,
    weeks: Math.ceil(days / 7),
    days,
    startDay: DEFAULT_START_DAY,
    pause: b.pause,
    resolutions: b.resolutions,
    acknowledged: b.acknowledged,
    sandbox: b.sandbox,
    interventions,
    stopWhenNeededAfterDay: b.stopWhenNeededFromOffset !== undefined ? DEFAULT_START_DAY + b.stopWhenNeededFromOffset - 1 : undefined,
  });
  const role = resolveRole(request, b.view);
  const opts = { digestFromDay: b.digestFromOffset !== undefined ? DEFAULT_START_DAY + b.digestFromOffset : undefined };
  const view = role === "dm" ? buildDmView(arentoria, result, opts) : buildPlayerView(arentoria, result, opts);
  return NextResponse.json({ role, warnings, view });
}
