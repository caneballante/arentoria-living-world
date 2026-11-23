import { NextResponse } from "next/server";
import { campaignIdOr404, dmOnly, loadCampaign } from "@/server/campaigns";

export const dynamic = "force-dynamic";

/** A published report as player-safe JSON (what DungeonShare will receive). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const denied = dmOnly(request);
  if (denied) return denied;
  const p = await params;
  const id = campaignIdOr404(p.id);
  if (id instanceof NextResponse) return id;
  const c = await loadCampaign(id);
  const e = c?.editions.find((x) => x.number === Number(p.n));
  if (!e) return NextResponse.json({ error: "No such report." }, { status: 404 });
  return NextResponse.json(e.content);
}
