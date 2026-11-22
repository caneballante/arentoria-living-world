import { describe, expect, it } from "vitest";
import { pairedWinRate, runBatch } from "../src/analysis/batch";
import { scenarios } from "../src/world";
import { START, world } from "./helpers";

describe("strategy comparison (seeded batches)", () => {
  const batch = runBatch(world, scenarios, { runs: 16, weeks: 26, startDay: START, seedPrefix: "strat" });
  const sum = (id: string) => batch.summaries.find((s) => s.scenarioId === id)!;

  it("runs every brief scenario for 26 weeks", () => {
    for (const id of ["commons-compliant", "grand-market-aggressive", "high-march-luxury", "low-price-volume", "fees-and-protection", "resilient-wholesale", "festival-seasonal"]) {
      expect(sum(id).runs).toBe(16);
      expect(sum(id).weeks).toBe(26);
    }
  });

  it("sound plans reliably outperform poor plans on the same seeds", () => {
    const sound = scenarios.filter((s) => s.quality === "sound");
    const poor = scenarios.filter((s) => s.quality === "poor");
    for (const a of sound) for (const b of poor) {
      expect(pairedWinRate(batch.runs[a.id]!, batch.runs[b.id]!), `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(0.9);
      expect(sum(a.id).totalProfitCp.mean).toBeGreaterThan(sum(b.id).totalProfitCp.mean);
    }
  });

  it("sound plans are profitable in most runs; poor plans mostly lose money", () => {
    for (const s of scenarios.filter((x) => x.quality === "sound")) expect(sum(s.id).pNetLoss, s.id).toBeLessThanOrEqual(0.1);
    for (const s of scenarios.filter((x) => x.quality === "poor")) expect(sum(s.id).pNetLoss, s.id).toBeGreaterThanOrEqual(0.7);
  });

  it("success does not automatically attract hostility (quiet luxury stays calm)", () => {
    const lux = sum("high-march-luxury");
    expect(lux.totalProfitCp.p50).toBeGreaterThan(0);
    expect(lux.threadReach.extortion![2]).toBeLessThanOrEqual(0.1);
    expect(lux.threadReach["rival-response"]![3]).toBeLessThanOrEqual(0.1);
  });

  it("risky plans carry more adverse events than conservative ones", () => {
    expect(sum("grand-market-aggressive").adverseEvents.mean).toBeGreaterThan(sum("commons-compliant").adverseEvents.mean * 2);
    expect(sum("low-price-volume").threadReach["rival-response"]![2]).toBeGreaterThan(sum("commons-compliant").threadReach["rival-response"]![2]!);
  });

  it("ordinary profitable operation is the norm for sound plans (crises are not weekly)", () => {
    for (const s of scenarios.filter((x) => x.quality === "sound")) expect(sum(s.id).adverseEvents.mean, s.id).toBeLessThan(6);
  });
});
