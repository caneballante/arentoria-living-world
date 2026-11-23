import { afterEach, describe, expect, it, vi } from "vitest";
import { dungeonShareSettings, dungeonShareStatus, DungeonShareError, sendReport, takeDownReport } from "../src/server/dungeonshare";
import type { EditionContent } from "../src/views/edition";

const TOKEN = "k".repeat(40);
const env = { DUNGEONSHARE_PIESHOP_TOKEN: TOKEN, DUNGEONSHARE_CAMPAIGN_SLUG: "arentoria" };
const settings = dungeonShareSettings(env)!;

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string, _init: RequestInit) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("DungeonShare settings", () => {
  it("need a long key and a campaign name; the site defaults to the live one", () => {
    expect(dungeonShareSettings({})).toBeNull();
    expect(dungeonShareSettings({ ...env, DUNGEONSHARE_PIESHOP_TOKEN: "short" })).toBeNull();
    expect(dungeonShareSettings({ ...env, DUNGEONSHARE_CAMPAIGN_SLUG: " " })).toBeNull();
    expect(settings.site).toBe("https://dungeonshare.vercel.app");
    expect(dungeonShareSettings({ ...env, DUNGEONSHARE_URL: "http://localhost:3000/" })!.site).toBe("http://localhost:3000");
  });

  it("only ever send the real campaign", () => {
    expect(dungeonShareStatus("party", env).ready).toBe(true);
    expect(dungeonShareStatus("test", env).ready).toBe(false);
    expect(dungeonShareStatus("party", {}).note).toMatch(/\.env\.local/);
  });
});

describe("sending to DungeonShare", () => {
  const report = { number: 3, choices: { neighborhood: "the Commons", standingOrders: { sellingOut: "raise-price" } } } as unknown as EditionContent;

  it("posts the report with the key, and never the manager's instructions", async () => {
    const fetch = stubFetch(201, { ok: true });
    await sendReport(settings, report);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://dungeonshare.vercel.app/api/pie-shop");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(String(init.body));
    expect(body.campaignSlug).toBe("arentoria");
    expect(body.report.number).toBe(3);
    expect(body.report.choices).not.toHaveProperty("standingOrders");
  });

  it("takes a report down by number", async () => {
    const fetch = stubFetch(200, { ok: true, removed: true });
    await takeDownReport(settings, 3);
    const [, init] = fetch.mock.calls[0]!;
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(String(init.body))).toEqual({ campaignSlug: "arentoria", number: 3 });
  });

  it("explains what went wrong in plain words", async () => {
    stubFetch(401, { ok: false, error: "A valid Pie Shop publishing token is required." });
    await expect(sendReport(settings, report)).rejects.toThrow(/didn't accept the key/);
    stubFetch(404, { ok: false, error: "Campaign not found." });
    await expect(sendReport(settings, report)).rejects.toThrow(/no campaign called "arentoria"/);
    stubFetch(404, "<html>not found</html>");
    await expect(sendReport(settings, report)).rejects.toThrow(/doesn't have the Pie Shop yet/);
    stubFetch(400, { ok: false, error: "Invalid Pie Shop report at report.title: too long" });
    await expect(sendReport(settings, report)).rejects.toThrow(/report\.title/);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(sendReport(settings, report)).rejects.toBeInstanceOf(DungeonShareError);
  });
});
