/**
 * Risk and reward: bold choices should widen the spread of outcomes in BOTH directions
 * (a real gamble), while careful plans stay narrow. Design guard rails — if calibration
 * breaks these, treat it as a design question.
 */
import { describe, expect, it } from "vitest";
import { runBatch } from "../src/analysis/batch";
import { planOf, START, world } from "./helpers";

describe("risky choices are gambles", () => {
  const careful = planOf("grand-market-careful");
  const pushed = { ...careful, constructWorkload: "pushed" as const, weeklyProduction: 1900 };
  const low = planOf("low-price-volume");
  const lowSteady = { ...low, constructWorkload: "steady" as const, weeklyProduction: 1470 };
  const batch = runBatch(
    world,
    [
      { id: "steady", label: "steady", plan: careful },
      { id: "pushed", label: "pushed", plan: pushed },
      { id: "low-pushed", label: "low-pushed", plan: low },
      { id: "low-steady", label: "low-steady", plan: lowSteady },
    ],
    { runs: 40, weeks: 52, startDay: START, seedPrefix: "risk" },
  );
  const s = (id: string) => batch.summaries.find((x) => x.scenarioId === id)!.totalProfitCp;

  it("pushing the constructs raises the upside and deepens the downside", () => {
    expect(s("pushed").p90).toBeGreaterThan(s("steady").p90 * 1.1);
    expect(s("pushed").p10).toBeLessThan(s("steady").p10 * 0.85);
    // ...without being a strictly bad bet.
    expect(s("pushed").p50).toBeGreaterThan(s("steady").p50);
  });

  it("bold plans have a much wider spread than careful ones", () => {
    const spread = (id: string) => s(id).p90 - s(id).p10;
    expect(spread("pushed")).toBeGreaterThan(spread("steady") * 3);
  });

  it("a risky plan can actually lose money in a bad year", () => {
    const lowPushed = batch.summaries.find((x) => x.scenarioId === "low-pushed")!;
    const lowSteady = batch.summaries.find((x) => x.scenarioId === "low-steady")!;
    expect(lowPushed.pNetLoss).toBeGreaterThan(0);
    expect(lowSteady.pNetLoss).toBe(0);
  });

  it("players get a warning before strain becomes dangerous", async () => {
    const { simulateScenario } = await import("../src/engine/simulate");
    const { buildAllReports } = await import("../src/narrative/weekly-report");
    const r = simulateScenario(world, { plan: pushed, seed: "risk-warn", weeks: 26, startDay: START });
    const reports = buildAllReports(world, r.state);
    const firstWarning = reports.findIndex((rep) => rep.lines.some((l) => l.text.includes("running hot")));
    const firstFire = r.state.events.find((e) => e.title === "Fire in the kitchen");
    expect(firstWarning).toBeGreaterThanOrEqual(0);
    if (firstFire) expect(firstWarning + 1).toBeLessThanOrEqual(firstFire.week);
  });
});
