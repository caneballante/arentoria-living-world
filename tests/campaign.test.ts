import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  acknowledge,
  advance,
  answer,
  CampaignError,
  campaignView,
  createCampaign,
  publish,
  publishedDay,
  recordAccount,
  revisePlan,
  rewind,
  runDraft,
  summarize,
  undoPublish,
  type CampaignFile,
} from "../src/campaign/model";
import type { WorldDefinition } from "../src/engine/types";
import { backupCampaign, loadCampaign, saveCampaign } from "../src/persistence/campaign-files";
import { planOf, START, world } from "./helpers";

const NOW = "2026-11-23T10:00:00Z";
const fresh = (id: "party" | "test" = "test", seed = "camp-1") =>
  createCampaign(world, { id, name: "Dawnfire Pies", plan: planOf("starting-out"), seed, startDay: START, startScenario: "starting-out", now: NOW });
const pub = (c: CampaignFile, note = "") => publish(world, c, { note, deadline: "Thursday", now: NOW, publishedAt: "23 Nov 2026" });

/** Advance, answering anything that stops the clock with its default, until `days` have passed. */
function play(c: CampaignFile, days: number): CampaignFile {
  let cur = advance(world, c, days, false, NOW);
  for (let i = 0; i < 20; i++) {
    const r = runDraft(world, cur);
    if (r.status !== "paused") return cur;
    if (r.pausedOnEvent) cur = acknowledge(world, cur, r.pausedOnEvent.id, NOW);
    for (const id of r.blocking) cur = answer(world, cur, id, r.pending.find((p) => p.id === id)!.defaultOptionId, NOW);
  }
  return cur;
}

describe("a campaign", () => {
  it("starts at day 0 with the starting plan and moves forward on request", () => {
    const c = fresh();
    expect(campaignView(world, c).view.clock.daysElapsed).toBe(0);
    const week = play(c, 7);
    const v = campaignView(world, week);
    expect(v.view.clock.daysElapsed).toBe(7);
    expect(v.campaign.draftDays).toBe(7);
    expect(v.view.state.weeks).toHaveLength(1);
  });

  it("publishes a numbered, player-safe report and continues from it", () => {
    const c = pub(play(fresh(), 14), "Welcome to the business");
    expect(c.editions).toHaveLength(1);
    const e = c.editions[0]!;
    expect(e.content.title).toBe("Report 1");
    expect(e.content.period.days).toBe(14);
    expect(e.content.note).toBe("Welcome to the business");
    expect(e.content.reports.length).toBe(2);
    expect(e.content.totals.weeks).toBe(2);
    const json = JSON.stringify(e.content);
    for (const secret of ['"basis"', '"hidden', '"traits"', '"drivers"', "honesty", "skimmed", "criminalAttention"]) expect(json).not.toContain(secret);
    expect(e.content.choices.standingOrders).toBeUndefined(); // a DM setting, kept out of the players' report
    expect(publishedDay(c)).toBe(START + 13);
    expect(summarize(world, c).draftDays).toBe(0);
    expect(campaignView(world, play(c, 7)).view.clock.daysElapsed).toBe(21);
  });

  it("keeps published history fixed even if the simulation's numbers change later", () => {
    const c = pub(play(fresh(), 14));
    const before = campaignView(world, c).view.state.weeks.map((w) => w.revenueCp);
    const commons = world.neighborhoods.commons!;
    const recalibrated: WorldDefinition = { ...world, neighborhoods: { ...world.neighborhoods, commons: { ...commons, demand: { ...commons.demand, referencePriceCp: 30 } } } };
    const after = campaignView(recalibrated, play(c, 7)).view.state.weeks.map((w) => w.revenueCp);
    expect(after.slice(0, 2)).toEqual(before);
  });

  it("can rewind the draft to the last report and replay it exactly", () => {
    const c = pub(play(fresh(), 7));
    const ahead = play(c, 14);
    const once = JSON.stringify(runDraft(world, ahead).state.weeks);
    const back = rewind(ahead, NOW);
    expect(campaignView(world, back).view.clock.daysElapsed).toBe(7);
    expect(JSON.stringify(runDraft(world, play(back, 14)).state.weeks)).toBe(once);
  });

  it("records a withdrawal straight away, and only the DM's amounts", () => {
    const c = play(fresh(), 14);
    const before = runDraft(world, c).state.business.cashCp;
    const after = recordAccount(world, c, { action: "withdraw", amountCp: 1500, note: "Rope and lanterns" }, NOW);
    const s = runDraft(world, after).state;
    expect(s.business.cashCp).toBe(before - 1500);
    expect(s.business.account.statement.some((e) => e.kind === "withdrawal" && e.authority === "dm")).toBe(true);
    expect(() => recordAccount(world, c, { action: "withdraw", note: "nothing" }, NOW)).toThrow(CampaignError);
  });

  it("revises the plan from tomorrow, within the business size", () => {
    const c = play(fresh(), 7);
    const cheaper = revisePlan(world, c, { ...planOf("starting-out"), priceCp: 9 }, NOW);
    expect(runDraft(world, play(cheaper, 7)).state.plan.priceCp).toBe(9);
    expect(() => revisePlan(world, c, { ...planOf("starting-out"), weeklyProduction: 900 }, NOW)).toThrow(/500 pies a week/);
    // The DM can grow the business by changing its size.
    const grown = revisePlan(world, c, { ...planOf("starting-out"), stage: "unrestricted", weeklyProduction: 900 }, NOW);
    expect(runDraft(world, play(grown, 7)).state.plan.weeklyProduction).toBe(900);
  });

  it("changes the starting plan outright before day 1", () => {
    const c = revisePlan(world, fresh(), { ...planOf("starting-out"), name: "Hot Pies & Co." }, NOW);
    expect(c.draft.interventions).toHaveLength(0);
    expect(runDraft(world, c).state.plan.name).toBe("Hot Pies & Co.");
  });

  it("puts open questions in the report, with what happens if nobody answers", () => {
    let c = fresh("test", "questions");
    let r = runDraft(world, c);
    for (let i = 0; i < 12 && !r.pending.some((p) => p.authority === "players" && !r.blocking.includes(p.id)); i++) {
      for (const id of r.blocking) c = answer(world, c, id, r.pending.find((p) => p.id === id)!.defaultOptionId, NOW);
      c = advance(world, c, 56, true, NOW);
      r = runDraft(world, c);
    }
    const open = r.pending.find((p) => p.authority === "players" && !r.blocking.includes(p.id));
    expect(open).toBeDefined();
    const answered = answer(world, c, open!.id, open!.options[0]!.id, NOW);
    const published = pub(answered);
    const q = published.editions[0]!.content.questions.find((x) => x.id === open!.id)!;
    expect(q.ifNoAnswer).toBeTruthy();
    expect(published.draft.resolutions[open!.id]).toBe(open!.options[0]!.id); // the early answer carries over
  });

  it("can undo the latest report and publish the same thing again", () => {
    const one = pub(play(fresh(), 7));
    const two = pub(play(one, 7), "second");
    const undone = undoPublish(two, NOW);
    expect(undone.editions).toHaveLength(1);
    expect(summarize(world, undone, runDraft(world, undone)).draftDays).toBe(7);
    const again = pub(undone, "second");
    expect(JSON.stringify(again.editions[1]!.content)).toBe(JSON.stringify(two.editions[1]!.content));
  });

  it("only lets the real campaign start over before its first report", () => {
    const real = fresh("party");
    expect(summarize(world, real).canStartOver).toBe(true);
    expect(summarize(world, pub(play(real, 7))).canStartOver).toBe(false);
    expect(summarize(world, pub(play(fresh("test"), 7))).canStartOver).toBe(true);
  });

  it("won't publish while the clock is stopped, or with nothing new", () => {
    expect(() => pub(fresh())).toThrow(/Nothing new/);
    let c = fresh("test", "stops");
    for (let i = 0; i < 10; i++) {
      if (runDraft(world, c).blocking.length) break;
      c = advance(world, c, 56, true, NOW);
    }
    const r = runDraft(world, c);
    if (r.blocking.length) expect(() => pub(c)).toThrow(/due today/);
  });
});

describe("campaign files", () => {
  let dir = "";
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    delete process.env.ARENTORIA_CAMPAIGN_DIR;
  });

  it("saves, loads and backs up a campaign", async () => {
    dir = await mkdtemp(join(tmpdir(), "arentoria-campaigns-"));
    process.env.ARENTORIA_CAMPAIGN_DIR = dir;
    expect(await loadCampaign("test")).toBeNull();
    const c = pub(play(fresh(), 7));
    await saveCampaign(c);
    const back = await loadCampaign("test");
    expect(JSON.stringify(back)).toBe(JSON.stringify(c));
    await backupCampaign("test", "publish", NOW);
    expect((await readdir(join(dir, "backups"))).length).toBe(1);
    expect(campaignView(world, back!).view.clock.daysElapsed).toBe(7);
  });
});

describe("notices in published reports", () => {
  const NOW2 = "2026-11-23T10:00:00Z";
  const reports = (() => {
    let c = createCampaign(world, { id: "test", name: "t", plan: planOf("starting-out"), seed: "ads", startDay: START, startScenario: "starting-out", now: NOW2 });
    c = setPauseNever(c);
    for (let i = 0; i < 4; i++) c = publish(world, advance(world, c, 7, false, NOW2), { note: "", deadline: "", now: NOW2, publishedAt: "x" });
    return c.editions.map((e) => e.content);
  })();

  it("carry a way to grow, another district, an option, and a bit of color", () => {
    for (const r of reports) {
      const kinds = (r.notices ?? []).map((n) => n.kind);
      expect(kinds).toContain("grow");
      expect(kinds).toContain("district");
      expect(kinds.filter((k) => k === "service").length).toBe(1);
      expect(kinds.some((k) => k === "rival" || k === "festival" || k === "hook")).toBe(true);
      expect(r.notices!.length).toBe(4);
    }
  });

  it("don't repeat an announced festival under 'Coming up'", () => {
    for (const r of reports) {
      const fest = r.notices!.find((n) => n.kind === "festival");
      if (fest) for (const c of r.comingUp) expect(c.festivalId).not.toBe(fest.ref);
    }
  });

  it("rotate from report to report, and never pitch the district you're already in", () => {
    const districts = reports.map((r) => r.notices!.find((n) => n.kind === "district")!.headline);
    expect(new Set(districts).size).toBe(reports.length);
    for (const h of districts) expect(h).not.toMatch(/COMMONS/);
    expect(new Set(reports.map((r) => r.notices!.find((n) => n.kind === "grow")!.headline)).size).toBeGreaterThan(1);
  });

  it("offer a second cart with staff to a one-cart business, with a price", () => {
    const cart = reports.flatMap((r) => r.notices!).find((n) => n.headline.startsWith("CART FOR SALE"));
    expect(cart?.price).toMatch(/gp/);
  });
});

function setPauseNever(c: CampaignFile): CampaignFile {
  return { ...c, pause: "never" };
}
