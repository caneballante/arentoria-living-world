import { NextResponse } from "next/server";
import { z } from "zod";
import { safeParsePlan } from "@/engine/plan";
import { checkPlan, simulateScenario } from "@/engine/simulate";
import { resolveRole } from "@/server/access";
import { buildDmView, buildPlayerView } from "@/views";
import { arentoria, DEFAULT_START_DAY } from "@/world";

const Body = z.object({
  plan: z.unknown(),
  seed: z.string().trim().min(1).max(80),
  weeks: z.number().int().min(1).max(104),
  pause: z.enum(["never", "decisions", "decisions-and-major"]).default("never"),
  resolutions: z.record(z.string(), z.string()).default({}),
  acknowledged: z.array(z.string()).default([]),
  view: z.enum(["dm", "player"]).default("dm"),
  sandbox: z.object({ licensingOutcome: z.enum(["approve", "delay", "deny"]) }).partial().default({}),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const body = Body.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Invalid request", issues: body.error.issues }, { status: 400 });
  const parsed = safeParsePlan(body.data.plan);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid business plan", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  const check = checkPlan(arentoria, parsed.data);
  if (check.errors.length) return NextResponse.json({ error: "Invalid business plan", issues: check.errors.map((m) => ({ path: "", message: m })) }, { status: 400 });

  const result = simulateScenario(arentoria, {
    plan: parsed.data,
    seed: body.data.seed,
    weeks: body.data.weeks,
    startDay: DEFAULT_START_DAY,
    pause: body.data.pause,
    resolutions: body.data.resolutions,
    acknowledged: body.data.acknowledged,
    sandbox: body.data.sandbox,
  });
  const role = resolveRole(request, body.data.view);
  const view = role === "dm" ? buildDmView(arentoria, result) : buildPlayerView(arentoria, result);
  return NextResponse.json({ role, warnings: check.warnings, view });
}
