/**
 * Sending published reports to DungeonShare's Pie Shop pages.
 *
 * Runs on the DM's machine only. Settings come from `.env.local` (never the browser):
 *   DUNGEONSHARE_PIESHOP_TOKEN   the Pie Shop key, the same value set on DungeonShare
 *   DUNGEONSHARE_CAMPAIGN_SLUG   the campaign's name in its DungeonShare address
 *   DUNGEONSHARE_URL             optional; defaults to the live site
 * Only the real ("party") campaign is ever sent; the test campaign stays on this machine.
 */
import type { CampaignId } from "@/campaign/model";
import type { EditionContent } from "@/views/edition";

const DEFAULT_SITE = "https://dungeonshare.vercel.app";

export interface DungeonShareSettings {
  site: string;
  token: string;
  slug: string;
}

export function dungeonShareSettings(env: Record<string, string | undefined> = process.env): DungeonShareSettings | null {
  const token = env.DUNGEONSHARE_PIESHOP_TOKEN?.trim() ?? "";
  const slug = env.DUNGEONSHARE_CAMPAIGN_SLUG?.trim() ?? "";
  if (token.length < 32 || !slug) return null;
  return { site: (env.DUNGEONSHARE_URL?.trim() || DEFAULT_SITE).replace(/\/+$/, ""), token, slug };
}

/** What the DM page shows about sending, for one campaign. */
export function dungeonShareStatus(id: CampaignId, env: Record<string, string | undefined> = process.env): { ready: boolean; site: string; note: string } {
  const s = dungeonShareSettings(env);
  if (id !== "party") return { ready: false, site: s?.site ?? DEFAULT_SITE, note: "The test campaign stays on this computer; only the real campaign is sent to DungeonShare." };
  if (!s) return { ready: false, site: DEFAULT_SITE, note: "To send reports to DungeonShare, add DUNGEONSHARE_PIESHOP_TOKEN and DUNGEONSHARE_CAMPAIGN_SLUG to .env.local, then restart the app." };
  return { ready: true, site: s.site, note: `Sends to ${s.site}/campaign/${s.slug}/pie-shop` };
}

export class DungeonShareError extends Error {}

async function call(s: DungeonShareSettings, method: "POST" | "DELETE", body: unknown): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${s.site}/api/pie-shop`, {
      method,
      headers: { authorization: `Bearer ${s.token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new DungeonShareError(`Couldn't reach DungeonShare at ${s.site}. Check the internet connection and try again. (${e instanceof Error ? e.message : String(e)})`);
  }
  if (res.ok) return;
  const detail = await res
    .json()
    .then((j: { error?: unknown }) => (typeof j?.error === "string" ? j.error : ""))
    .catch(() => "");
  if (res.status === 401) throw new DungeonShareError("DungeonShare didn't accept the key. DUNGEONSHARE_PIESHOP_TOKEN in .env.local must match the Pie Shop key set on DungeonShare.");
  if (res.status === 404 && /campaign/i.test(detail)) throw new DungeonShareError(`DungeonShare has no campaign called "${s.slug}". Check DUNGEONSHARE_CAMPAIGN_SLUG in .env.local.`);
  if (res.status === 404 || res.status === 405) throw new DungeonShareError(`DungeonShare at ${s.site} doesn't have the Pie Shop yet. It needs the Pie Shop update deployed first.`);
  throw new DungeonShareError(`DungeonShare said no (${res.status})${detail ? `: ${detail}` : "."}`);
}

export function sendReport(s: DungeonShareSettings, report: EditionContent): Promise<void> {
  // Reports published before the manager's instructions were hidden still carry them: never send those.
  const { standingOrders: _hidden, ...choices } = report.choices;
  return call(s, "POST", { campaignSlug: s.slug, report: { ...report, choices } });
}

export function takeDownReport(s: DungeonShareSettings, number: number): Promise<void> {
  return call(s, "DELETE", { campaignSlug: s.slug, number });
}
