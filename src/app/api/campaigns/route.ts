import { NextResponse } from "next/server";
import { z } from "zod";
import { CAMPAIGN_IDS, createCampaign, summarize } from "@/campaign/model";
import { backupCampaign, campaignIdOr404, dmOnly, errorResponse, loadCampaign, nowIso, respondView, saveCampaign, serialized, world } from "@/server/campaigns";
import { DEFAULT_START_DAY, getScenario, scenarios } from "@/world";

export const dynamic = "force-dynamic";

/** Both campaigns: whether they exist yet, and where they stand. */
export async function GET(request: Request) {
  const denied = dmOnly(request);
  if (denied) return denied;
  const list = await Promise.all(
    CAMPAIGN_IDS.map(async (id) => {
      const c = await loadCampaign(id);
      return c ? { id, exists: true as const, summary: summarize(world, c) } : { id, exists: false as const };
    }),
  );
  return NextResponse.json({ campaigns: list });
}

const Create = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(80).optional(),
  scenarioId: z.string().optional(),
  seed: z.string().trim().min(1).max(60).optional(),
  /** The district the players chose, and the price per pie (cp). */
  neighborhood: z.string().optional(),
  priceCp: z.number().int().min(1).max(200).optional(),
});

/** Start the real campaign (or start it over before its first report), or (re)start the test campaign. */
export async function POST(request: Request) {
  const denied = dmOnly(request);
  if (denied) return denied;
  const body = Create.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request", issues: body.error.issues }, { status: 400 });
  const id = campaignIdOr404(body.data.id);
  if (id instanceof NextResponse) return id;
  const scenarioId = body.data.scenarioId ?? "starting-out";
  if (!scenarios.some((s) => s.id === scenarioId)) return NextResponse.json({ error: `Unknown starting plan "${scenarioId}".` }, { status: 400 });
  return serialized(id, async () => {
    try {
      const existing = await loadCampaign(id);
      if (existing && id === "party" && existing.editions.length > 0) {
        return NextResponse.json({ error: "The real campaign has published reports, so it can't be started over. Undo reports first, or use the test campaign." }, { status: 409 });
      }
      const now = nowIso();
      if (existing) await backupCampaign(id, "restart", now);
      const plan = structuredClone(getScenario(scenarioId).plan);
      if (body.data.name) plan.name = body.data.name;
      if (body.data.neighborhood) plan.neighborhood = body.data.neighborhood;
      if (body.data.priceCp) plan.priceCp = body.data.priceCp;
      const seed = body.data.seed ?? `${id}-${now.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`;
      const c = createCampaign(world, { id, name: id === "party" ? plan.name : "Test campaign", plan, seed, startDay: DEFAULT_START_DAY, startScenario: scenarioId, now });
      await saveCampaign(c);
      return respondView(c);
    } catch (e) {
      return errorResponse(e);
    }
  });
}
