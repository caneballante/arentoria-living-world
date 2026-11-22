import { describe, expect, it } from "vitest";
import { createInitialState, restore, runSimulation, simulateScenario, snapshot } from "../src/engine/simulate";
import { planOf, run, START, world } from "./helpers";

describe("determinism and replay", () => {
  it("identical seeds and initial conditions reproduce identical outcomes", () => {
    for (const id of ["commons-compliant", "grand-market-aggressive", "low-price-volume"]) {
      const a = run(id, "same-seed", 26);
      const b = run(id, "same-seed", 26);
      expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    }
  });

  it("different seeds produce different (but similar-scale) outcomes", () => {
    const a = run("commons-compliant", "seed-a", 26).state;
    const b = run("commons-compliant", "seed-b", 26).state;
    expect(JSON.stringify(a.weeks)).not.toBe(JSON.stringify(b.weeks));
    const pa = a.weeks.reduce((x, w) => x + w.profitCp, 0);
    const pb = b.weeks.reduce((x, w) => x + w.profitCp, 0);
    expect(Math.abs(pa - pb) / Math.max(Math.abs(pa), 1)).toBeLessThan(0.5);
  });

  it("resuming from a JSON snapshot equals an uninterrupted run", () => {
    const plan = planOf("grand-market-aggressive");
    const straight = simulateScenario(world, { plan, seed: "snap", weeks: 26, startDay: START });
    const initial = createInitialState(world, plan, { seed: "snap", startDay: START });
    const first = runSimulation(world, initial, { weeks: 10 });
    const restored = restore(snapshot(first.state));
    const rest = runSimulation(world, restored, { untilDay: START + 26 * 7 - 1 });
    expect(JSON.stringify(rest.state)).toBe(JSON.stringify(straight.state));
  });

  it("splitting a run at an arbitrary mid-week day changes nothing", () => {
    const plan = planOf("commons-compliant");
    const straight = simulateScenario(world, { plan, seed: "split", weeks: 8, startDay: START });
    const initial = createInitialState(world, plan, { seed: "split", startDay: START });
    const part1 = runSimulation(world, initial, { untilDay: START + 17 });
    const part2 = runSimulation(world, part1.state, { untilDay: START + 8 * 7 - 1 });
    expect(JSON.stringify(part2.state)).toBe(JSON.stringify(straight.state));
  });

  it("does not mutate the input state", () => {
    const initial = createInitialState(world, planOf("commons-compliant"), { seed: "pure", startDay: START });
    const before = JSON.stringify(initial);
    runSimulation(world, initial, { weeks: 4 });
    expect(JSON.stringify(initial)).toBe(before);
  });

  it("interactive pause/resume with the same choices equals an unattended run", () => {
    const plan = planOf("grand-market-aggressive");
    const auto = simulateScenario(world, { plan, seed: "pause", weeks: 26, startDay: START });
    const decisions = auto.state.history.filter((h) => h.cause.kind === "decision");
    expect(decisions.length).toBeGreaterThan(0);

    // Step through every pause, answering exactly as the standing orders would have.
    let state = createInitialState(world, plan, { seed: "pause", startDay: START });
    const until = START + 26 * 7 - 1;
    let pauses = 0;
    for (;;) {
      const r = runSimulation(world, state, { untilDay: until, pause: "decisions" });
      state = r.state;
      if (r.status === "completed") break;
      pauses++;
      const resolutions: Record<string, string> = {};
      for (const p of r.pending.filter((x) => r.blocking.includes(x.id))) {
        const record = auto.state.events.find((e) => e.decisionId === p.id);
        expect(record?.resolution, `decision ${p.id} also occurs in the unattended run`).toBeDefined();
        resolutions[p.id] = record!.resolution!.optionId;
      }
      state = runSimulation(world, state, { untilDay: state.day - 1, resolutions }).state;
    }
    expect(pauses).toBe(decisions.length);
    const strip = (s: typeof state) =>
      JSON.stringify({
        ...s,
        history: s.history.map((h) => ({ ...h, authority: "x", description: h.description.replace(" (no answer by the deadline)", "") })),
        events: s.events.map((e) => ({ ...e, resolution: e.resolution && { ...e.resolution, authority: "x" } })),
      });
    expect(strip(state)).toBe(strip(auto.state));
  });

  it("stateless replay with supplied resolutions reproduces a paused session", () => {
    const plan = planOf("grand-market-aggressive");
    const first = simulateScenario(world, { plan, seed: "replay", weeks: 26, startDay: START, pause: "decisions" });
    expect(first.status).toBe("paused");
    const p = first.pending.find((x) => first.blocking.includes(x.id))!;
    const choice = p.options[p.options.length - 1]!.id;
    const a = simulateScenario(world, { plan, seed: "replay", weeks: 26, startDay: START, pause: "decisions", resolutions: { [p.id]: choice } });
    const b = simulateScenario(world, { plan, seed: "replay", weeks: 26, startDay: START, pause: "decisions", resolutions: { [p.id]: choice } });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.state.events.find((e) => e.decisionId === p.id)?.resolution?.optionId).toBe(choice);
  });

  it("uses common random numbers: weather is identical across business plans with the same seed", () => {
    const a = run("commons-compliant", "crn", 12).state;
    const b = run("high-march-luxury", "crn", 12).state;
    expect(a.weeks.map((w) => w.weather)).toEqual(b.weeks.map((w) => w.weather));
    expect(a.weeks.map((w) => w.avgPriceIndex)).toEqual(b.weeks.map((w) => w.avgPriceIndex));
  });
});
