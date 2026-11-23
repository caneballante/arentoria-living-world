/**
 * Server glue for campaigns: load, change and save a campaign file, one change at a time.
 * DM-only: campaign files hold hidden state, so every route checks the role first.
 */
import { NextResponse } from "next/server";
import { CampaignError, campaignView, isCampaignId, type CampaignFile, type CampaignId } from "@/campaign/model";
import { backupCampaign, loadCampaign, saveCampaign } from "@/persistence/campaign-files";
import { resolveRole } from "@/server/access";
import { DungeonShareError, dungeonShareStatus } from "@/server/dungeonshare";
import { arentoria } from "@/world";

export const world = arentoria;

export const nowIso = () => new Date().toISOString();
/** The real-world date a report was published, as the DM would write it. */
export const todayLabel = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function dmOnly(request: Request): NextResponse | null {
  return resolveRole(request, "dm") === "dm" ? null : NextResponse.json({ error: "Only the DM can open campaigns." }, { status: 403 });
}

export function campaignIdOr404(id: string): CampaignId | NextResponse {
  return isCampaignId(id) ? id : NextResponse.json({ error: `There's no campaign called "${id}".` }, { status: 404 });
}

// One change at a time per campaign (the app runs as a single local process).
const queues = new Map<string, Promise<unknown>>();
export function serialized<T>(id: CampaignId, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(id) ?? Promise.resolve();
  const next = prev.then(task, task);
  queues.set(id, next.catch(() => undefined));
  return next;
}

export function respondView(c: CampaignFile) {
  return NextResponse.json({ ...campaignView(world, c), dungeonShare: dungeonShareStatus(c.id) });
}

export function errorResponse(e: unknown) {
  if (e instanceof CampaignError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof DungeonShareError) return NextResponse.json({ error: e.message }, { status: 502 });
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

export { backupCampaign, loadCampaign, saveCampaign };
