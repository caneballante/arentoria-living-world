import { describe, expect, it } from "vitest";
import { advance, createCampaign, revisePlan, runDraft } from "../src/campaign/model";
import { applyIntervention } from "../src/engine/simulate";
import { planOf, run, START, world } from "./helpers";

describe("moving to another district", () => {
  const before = run("commons-compliant", "move", 30).state;
  const h0 = before.business.hidden;
  const moved = applyIntervention(world, before, {
    authority: "players",
    description: "Moved to the Grand Market",
    effects: [{ kind: "plan", patch: { neighborhood: "grand-market" }, note: "Move" }],
  });
  const h1 = moved.state.business.hidden;
  const m = world.assumptions.move;

  it("leaves name recognition and regulars behind, and half the reputation travels", () => {
    expect(h1.visibility).toBeCloseTo(h0.visibility * m.visibilityKept, 1);
    expect(h1.loyalty).toBeCloseTo(h0.loyalty * m.regularsKept, 1);
    expect(h1.reputation).toBeCloseTo(50 + (h0.reputation - 50) * m.reputationKept, 1);
  });

  it("leaves the old crew and rival behind, and ends standing orders", () => {
    expect(h1.criminalAttention).toBeCloseTo(world.assumptions.initialHidden.criminalAttention, 1);
    expect(h1.rivalHostility).toBeCloseTo(world.assumptions.initialHidden.rivalHostility, 1);
    for (const id of m.localThreads) expect(moved.state.threads[id]!.stage).toBe(0);
    expect(moved.state.business.wholesaleAccounts).toBe(0);
  });

  it("keeps what is citywide: the guild, the officials, the kitchen and the money", () => {
    expect(h1.guildRelation).toBe(h0.guildRelation);
    expect(h1.scrutiny).toBe(h0.scrutiny);
    expect(h1.constructStrain).toBe(h0.constructStrain);
    expect(moved.state.business.cashCp).toBe(before.business.cashCp);
  });

  it("is written in the audit trail and told to the players", () => {
    expect(moved.change.effects.filter((e) => e.kind === "adjust").length).toBeGreaterThan(0);
    expect(moved.state.knowledge.some((k) => k.text.startsWith("We moved to the Grand Market"))).toBe(true);
  });

  it("only happens when the district actually changes", () => {
    const priceOnly = applyIntervention(world, before, { authority: "players", description: "Price", effects: [{ kind: "plan", patch: { priceCp: 12 }, note: "Price" }] });
    expect(priceOnly.change.effects).toHaveLength(1);
    expect(priceOnly.state.business.hidden).toEqual(h0);
  });

  it("in a campaign: choosing the district before day 1 isn't a move, changing it later is", () => {
    const NOW = "2026-11-23T10:00:00Z";
    const c = createCampaign(world, { id: "test", name: "t", plan: planOf("starting-out"), seed: "mv", startDay: START, startScenario: "starting-out", now: NOW });
    const chosen = revisePlan(world, c, { ...planOf("starting-out"), neighborhood: "outer-ward" }, NOW);
    expect(chosen.draft.interventions).toHaveLength(0);
    expect(runDraft(world, chosen).state.plan.neighborhood).toBe("outer-ward");
    const later = revisePlan(world, advance(world, chosen, 21, false, NOW), { ...planOf("starting-out"), neighborhood: "stoneback" }, NOW);
    const s = runDraft(world, advance(world, later, 7, false, NOW)).state;
    expect(s.plan.neighborhood).toBe("stoneback");
    expect(s.knowledge.some((k) => k.text.startsWith("We moved to Stoneback"))).toBe(true);
  });
});

describe("telling the players about a move", () => {
  it("puts the move in that week's short report", async () => {
    const { buildAllReports } = await import("../src/narrative/weekly-report");
    const { simulateScenario } = await import("../src/engine/simulate");
    const r = simulateScenario(world, {
      plan: planOf("commons-compliant"),
      seed: "move-report",
      weeks: 4,
      startDay: START,
      interventions: [{ day: START + 10, authority: "players", description: "Move", refId: "mv", effects: [{ kind: "plan", patch: { neighborhood: "scholarium" }, note: "Move" }] }],
    });
    const week2 = buildAllReports(world, r.state)[1]!;
    const line = week2.lines.find((l) => l.text.startsWith("We moved to the Scholarium"));
    expect(line?.brief).toBe(true);
  });
});
