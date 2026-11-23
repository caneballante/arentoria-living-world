/**
 * Campaign files on the DM's own machine. Server-side only (Node file system).
 *
 * Location: ./campaigns (kept out of git), or ARENTORIA_CAMPAIGN_DIR if set.
 * Each campaign is one JSON file (party.json, test.json). Writes are atomic (write a
 * temporary file, then rename), and before every publish, undo or restart the previous
 * file is copied to campaigns/backups/ (the newest few are kept).
 */
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isCampaignId, type CampaignFile, type CampaignId } from "../campaign/model";

const BACKUPS_KEPT = 15;

export function campaignDir(): string {
  return process.env.ARENTORIA_CAMPAIGN_DIR || join(process.cwd(), "campaigns");
}

function fileFor(id: CampaignId): string {
  if (!isCampaignId(id)) throw new Error(`Unknown campaign "${id}"`);
  return join(campaignDir(), `${id}.json`);
}

export async function loadCampaign(id: CampaignId): Promise<CampaignFile | null> {
  try {
    const json = await readFile(fileFor(id), "utf8");
    const c = JSON.parse(json) as CampaignFile;
    if (c.format !== 1 || c.id !== id) throw new Error(`campaigns/${id}.json is not a campaign file this version understands.`);
    return c;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function saveCampaign(c: CampaignFile): Promise<void> {
  const dir = campaignDir();
  await mkdir(dir, { recursive: true });
  const target = fileFor(c.id);
  const tmp = `${target}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(c), "utf8");
  await rename(tmp, target);
}

/** Copy the current file aside before a step that's hard to reverse. */
export async function backupCampaign(id: CampaignId, reason: string, stamp: string): Promise<void> {
  const dir = join(campaignDir(), "backups");
  await mkdir(dir, { recursive: true });
  const safeStamp = stamp.replace(/[^0-9A-Za-z-]/g, "-");
  try {
    await copyFile(fileFor(id), join(dir, `${id}-${safeStamp}-${reason}.json`));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return;
  }
  const mine = (await readdir(dir)).filter((f) => f.startsWith(`${id}-`) && f.endsWith(".json")).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - BACKUPS_KEPT))) await rm(join(dir, old), { force: true });
}
