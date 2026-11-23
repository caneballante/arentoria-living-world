import { NextResponse } from "next/server";
import { z } from "zod";
import { acknowledge, advance, answer, publish, recordAccount, revisePlan, rewind, setPause, undoPublish, type CampaignFile } from "@/campaign/model";
import { backupCampaign, campaignIdOr404, dmOnly, errorResponse, loadCampaign, nowIso, respondView, saveCampaign, serialized, todayLabel, world } from "@/server/campaigns";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const denied = dmOnly(request);
  if (denied) return denied;
  const id = campaignIdOr404((await params).id);
  if (id instanceof NextResponse) return id;
  const c = await loadCampaign(id);
  if (!c) return NextResponse.json({ error: "Not started yet." }, { status: 404 });
  try {
    return respondView(c);
  } catch (e) {
    return errorResponse(e);
  }
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), days: z.number().int().min(1).max(182), untilNeeded: z.boolean().default(false) }),
  z.object({ action: z.literal("answer"), decisionId: z.string().min(1), optionId: z.string().min(1) }),
  z.object({ action: z.literal("acknowledge"), eventId: z.string().min(1) }),
  z.object({ action: z.literal("plan"), plan: z.unknown() }),
  z.object({
    action: z.literal("account"),
    entry: z.object({ action: z.enum(["withdraw", "deposit", "relocate"]), amountCp: z.number().int().min(1).max(100_000_000).optional(), location: z.string().trim().max(120).optional(), note: z.string().trim().max(200).default("") }),
  }),
  z.object({ action: z.literal("rewind") }),
  z.object({ action: z.literal("pause"), pause: z.enum(["never", "decisions", "decisions-and-major"]) }),
  z.object({ action: z.literal("publish"), note: z.string().max(2000).default(""), deadline: z.string().max(120).default("") }),
  z.object({ action: z.literal("undo-publish") }),
]);

export async function POST(request: Request, { params }: Ctx) {
  const denied = dmOnly(request);
  if (denied) return denied;
  const id = campaignIdOr404((await params).id);
  if (id instanceof NextResponse) return id;
  const body = Action.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request", issues: body.error.issues }, { status: 400 });
  const a = body.data;
  return serialized(id, async () => {
    const c = await loadCampaign(id);
    if (!c) return NextResponse.json({ error: "Not started yet." }, { status: 404 });
    try {
      const now = nowIso();
      let next: CampaignFile;
      switch (a.action) {
        case "advance":
          next = advance(world, c, a.days, a.untilNeeded, now);
          break;
        case "answer":
          next = answer(world, c, a.decisionId, a.optionId, now);
          break;
        case "acknowledge":
          next = acknowledge(world, c, a.eventId, now);
          break;
        case "plan":
          next = revisePlan(world, c, a.plan as never, now);
          break;
        case "account":
          next = recordAccount(world, c, a.entry, now);
          break;
        case "rewind":
          next = rewind(c, now);
          break;
        case "pause":
          next = setPause(c, a.pause, now);
          break;
        case "publish":
          await backupCampaign(id, "before-publish", now);
          next = publish(world, c, { note: a.note, deadline: a.deadline, now, publishedAt: todayLabel() });
          break;
        case "undo-publish":
          await backupCampaign(id, "before-undo", now);
          next = undoPublish(c, now);
          break;
      }
      await saveCampaign(next);
      return respondView(next);
    } catch (e) {
      return errorResponse(e);
    }
  });
}
