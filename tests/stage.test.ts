import { describe, expect, it } from "vitest";
import { parsePlan } from "../src/engine/plan";
import { applyIntervention, checkPlan, createInitialState, stageViolations } from "../src/engine/simulate";
import { BRIEF_LINES, buildAllReports } from "../src/narrative/weekly-report";
import { buildPlayerView } from "../src/views";
import { scenarios } from "../src/world";
import { planOf, run, START, world } from "./helpers";

describe("business size: starting out", () => {
  const starter = planOf("starting-out");

  it("is where the sandbox begins, and fits its own limits", () => {
    expect(scenarios[0]!.id).toBe("starting-out");
    expect(checkPlan(world, parsePlan(starter)).errors).toEqual([]);
  });

  it("allows one cart, one seller and up to 500 pies a week, with the constructs at a steady pace", () => {
    const tooBig = parsePlan({
      ...starter,
      weeklyProduction: 700,
      constructWorkload: "pushed",
      festivalProductionMultiplier: 1.5,
      channels: [
        { type: "cart", share: 0.5 },
        { type: "stall", share: 0.5 },
      ],
      staff: [
        { candidateId: "pell-marrow", role: "vendor", wageCpPerDay: 22 },
        { candidateId: "dob-hennick", role: "vendor", wageCpPerDay: 18 },
        { candidateId: "tam-greaves", role: "guard", wageCpPerDay: 40 },
      ],
    });
    const problems = stageViolations(world, tooBig);
    expect(problems.join(" ")).toMatch(/market stall/);
    expect(problems.join(" ")).toMatch(/1 hire, not 3/);
    expect(problems.join(" ")).toMatch(/guard/);
    expect(problems.join(" ")).toMatch(/500 pies a week, not 700/);
    expect(problems.join(" ")).toMatch(/pushing the constructs/);
    expect(problems.join(" ")).toMatch(/festival/);
    expect(problems.length).toBe(6);
    expect(checkPlan(world, tooBig).errors).toEqual(problems);
  });

  it("allows only one cart, not two", () => {
    const twoCarts = parsePlan({ ...starter, channels: [{ type: "cart", share: 0.5 }, { type: "cart", share: 0.5 }] });
    expect(stageViolations(world, twoCarts)).toEqual(["Starting out allows 1 street cart, not 2."]);
  });

  it("can't be started with a bigger plan", () => {
    expect(() => createInitialState(world, { ...starter, weeklyProduction: 900 }, { seed: "s", startDay: START })).toThrow(/500 pies a week/);
  });

  it("can't be grown by a plan revision; the DM changes the size first", () => {
    const mid = run("starting-out", "grow", 4).state;
    const addStall = { channels: [{ type: "cart" as const, share: 0.6 }, { type: "stall" as const, share: 0.4 }] };
    expect(() => applyIntervention(world, mid, { authority: "players", description: "bigger", effects: [{ kind: "plan", patch: addStall, note: "add a stall" }] })).toThrow(/market stall/);
    const grown = applyIntervention(world, mid, { authority: "dm", description: "The business grows", effects: [{ kind: "plan", patch: { ...addStall, stage: "unrestricted" }, note: "DM unlocks a bigger size" }] });
    expect(grown.state.plan.channels).toHaveLength(2);
  });

  it("older plans keep working with no limits", () => {
    expect(parsePlan(planOf("grand-market-aggressive")).stage).toBe("unrestricted");
    expect(checkPlan(world, parsePlan(planOf("grand-market-aggressive"))).errors).toEqual([]);
  });

  it("a starting cart makes a small profit over a season", () => {
    const r = run("starting-out", "small", 26);
    const profit = r.state.weeks.reduce((a, w) => a + w.profitCp, 0);
    expect(profit).toBeGreaterThan(0);
    expect(Math.max(...r.state.weeks.map((w) => w.produced))).toBeLessThanOrEqual(500);
  });
});

describe("short reports", () => {
  const r = run("grand-market-aggressive", "busy", 26);
  const reports = buildAllReports(world, r.state);

  it("keep the summary plus at most three notes", () => {
    for (const rep of reports) {
      const brief = rep.lines.filter((l) => l.brief);
      expect(brief.length).toBeLessThanOrEqual(1 + BRIEF_LINES);
      expect(rep.lines[0]!.section).toBe("summary");
      expect(rep.lines[0]!.brief).toBe(true);
    }
    expect(reports.some((rep) => rep.lines.length > 1 + BRIEF_LINES)).toBe(true);
  });

  it("keep the most important notes, so events outrank the weather", () => {
    for (const rep of reports) {
      const keptWeights = rep.lines.slice(1).filter((l) => l.brief).map((l) => l.weight!);
      const droppedWeights = rep.lines.slice(1).filter((l) => !l.brief).map((l) => l.weight!);
      if (keptWeights.length === BRIEF_LINES && droppedWeights.length) expect(Math.min(...keptWeights)).toBeGreaterThanOrEqual(Math.max(...droppedWeights));
      const major = rep.lines.find((l) => l.section === "events" && (l.weight ?? 0) >= 100);
      if (major) expect(major.brief).toBe(true);
    }
  });

  it("are what players see", () => {
    const view = buildPlayerView(world, r);
    for (const rep of view.reports) expect(rep.lines.length).toBeLessThanOrEqual(1 + BRIEF_LINES);
  });
});
