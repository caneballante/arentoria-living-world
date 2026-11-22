import { NextResponse } from "next/server";
import { z } from "zod";
import { pairedWinRate, runBatch, type BatchScenario } from "@/analysis/batch";
import { safeParsePlan } from "@/engine/plan";
import { checkPlan } from "@/engine/simulate";
import { arentoria, DEFAULT_START_DAY, scenarios } from "@/world";

const Body = z.object({
  scenarioIds: z.array(z.string()).max(12).default([]),
  customPlan: z.unknown().optional(),
  runs: z.number().int().min(1).max(60).default(20),
  weeks: z.number().int().min(1).max(52).default(26),
  seedPrefix: z.string().trim().min(1).max(40).default("cmp"),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request", issues: body.error.issues }, { status: 400 });
  const chosen: BatchScenario[] = scenarios.filter((s) => body.data.scenarioIds.includes(s.id)).map((s) => ({ id: s.id, label: s.label, plan: s.plan }));
  if (body.data.customPlan !== undefined) {
    const parsed = safeParsePlan(body.data.customPlan);
    if (!parsed.success) return NextResponse.json({ error: "Invalid custom plan", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
    const check = checkPlan(arentoria, parsed.data);
    if (check.errors.length) return NextResponse.json({ error: "Invalid custom plan", issues: check.errors.map((m) => ({ path: "", message: m })) }, { status: 400 });
    chosen.unshift({ id: "custom", label: `Your plan: ${parsed.data.name}`, plan: parsed.data });
  }
  if (!chosen.length) return NextResponse.json({ error: "Choose at least one scenario" }, { status: 400 });
  const batch = runBatch(arentoria, chosen, { runs: body.data.runs, weeks: body.data.weeks, startDay: DEFAULT_START_DAY, seedPrefix: body.data.seedPrefix });
  const paired: { a: string; b: string; winRate: number }[] = [];
  for (const a of chosen) for (const b of chosen) if (a.id !== b.id) paired.push({ a: a.id, b: b.id, winRate: pairedWinRate(batch.runs[a.id]!, batch.runs[b.id]!) });
  return NextResponse.json({ options: batch.options, summaries: batch.summaries, paired });
}
