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
  /**
   * DM-recorded account actions (party withdrawals and deposits, or where the money is kept),
   * applied at the start of day `dayOffset`. Only the DM may send these.
   */
  accountActions: z
    .array(
      z.object({
        dayOffset: z.number().int().min(0).max(MAX_DAYS),
        action: z.enum(["withdraw", "deposit", "relocate"]),
        amountCp: z.number().int().min(0).max(10_000_000).optional(),
        location: z.string().trim().max(120).optional(),
        note: z.string().trim().max(200).default(""),
      }),
    )
    .max(500)
    .default([]),
  /** Advance until something needs the party: stop on decisions/major events after this day offset. */
  stopWhenNeededFromOffset: z.number().int().min(0).max(MAX_DAYS).optional(),
  /** Build a "since last time" digest from this day offset. */
  digestFromOffset: z.number().int().min(0).max(MAX_DAYS).optional(),
  view: z.enum(["dm", "player"]).default("dm"),
  sandbox: z
    .object({ licensingOutcome: z.enum(["approve", "delay", "deny"]), inspectionRulings: z.enum(["uphold", "lenient"]), partyTopUps: z.enum(["when-cut-off", "never"]) })
    .partial()
    .default({}),
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
  let stage = base.plan.stage;
  for (const [i, change] of b.planChanges.entries()) {
    const v = validatePlan(change.plan, `planChanges[${i}]`);
    if (!v.plan || v.issues.length) return NextResponse.json({ error: "Invalid revised plan", issues: v.issues }, { status: 400 });
    // Growing (or shrinking) the business is the DM's call — enforced here, not in the browser.
    const resized = v.plan.stage !== stage;
    if (resized && resolveRole(request, "dm") !== "dm") {
      return NextResponse.json({ error: "Only the DM can change the size of the business." }, { status: 403 });
    }
    const sizeLabel = arentoria.stages[v.plan.stage]?.label ?? v.plan.stage;
    stage = v.plan.stage;
    warnings = v.warnings;
    interventions.push({
      day: DEFAULT_START_DAY + change.dayOffset,
      authority: resized ? "dm" : "players",
      description: resized ? `The DM changed the business size to "${sizeLabel}" and revised the plan` : "Business plan revised between sessions",
      refId: `plan-change-${i + 1}`,
      effects: [{ kind: "plan", patch: v.plan, note: resized ? `Business size: ${sizeLabel}` : "Plan revised" }],
    });
  }

  // Withdrawals and deposits are the DM's to record — enforced here, not in the browser.
  if (b.accountActions.length && resolveRole(request, "dm") !== "dm") {
    return NextResponse.json({ error: "Only the DM can record withdrawals and deposits." }, { status: 403 });
  }
  for (const [i, a] of b.accountActions.entries()) {
    const label = a.action === "withdraw" ? "Withdrawal" : a.action === "deposit" ? "Deposit" : "Money moved";
    interventions.push({
      day: DEFAULT_START_DAY + a.dayOffset,
      authority: "dm",
      description: `${label} recorded by the DM${a.note ? `: ${a.note}` : ""}`,
      refId: `account-${i + 1}`,
      effects: [{ kind: "account", action: a.action, amountCp: a.amountCp, location: a.location, note: a.note }],
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
