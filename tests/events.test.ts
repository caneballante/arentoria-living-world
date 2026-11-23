import { describe, expect, it } from "vitest";
import { runBatch } from "../src/analysis/batch";
import { createInitialState, runSimulation, simulateScenario } from "../src/engine/simulate";
import { planOf, run, START, stepToDecision, world } from "./helpers";

describe("event system", () => {
  it("triggers conditional events from real conditions within a 26-week season", () => {
    const s = run("commons-compliant", "events", 26).state;
    const random = new Set(world.events.map((d) => d.id));
    const conditional = s.events.filter((e) => random.has(e.eventId));
    expect(conditional.length).toBeGreaterThan(0);
    for (const e of conditional) {
      expect(e.probability).toBeGreaterThan(0);
      expect(e.drivers?.length).toBeGreaterThan(0);
      expect(e.provenance).toBe("simulated");
    }
  });

  it("fires the canon-anchored licensing decision as a DM decision that can pause the run", () => {
    const { result: r, decision: lic } = stepToDecision("commons-compliant", "lic", 26, (p) => p.id.startsWith("dec:construct-license-decision"));
    expect(r.status).toBe("paused");
    expect(lic?.authority).toBe("dm");
    // Deny instead of the sandbox default and confirm the consequence is recorded.
    const denied = runSimulation(world, r.state, { untilDay: r.state.day - 1, resolutions: { [lic!.id]: "deny" } }).state;
    expect(denied.business.licensing.status).toBe("denied");
    expect(denied.history.at(-1)?.authority).toBe("dm");
  });

  it("can stop mid-week when a major event occurs", () => {
    const r = simulateScenario(world, { plan: planOf("grand-market-aggressive"), seed: "major", weeks: 26, startDay: START, pause: "decisions-and-major" });
    expect(r.status).toBe("paused");
    const pausedDay = r.state.day - 1;
    const dayInWeek = (pausedDay - START) % 7;
    expect(r.pausedOnEvent || r.pending.length).toBeTruthy();
    expect(dayInWeek).toBeGreaterThanOrEqual(0);
    // Stopped mid-week, the week's days so far are kept; stopped at a week's close, the books are done and a new week begins.
    expect(r.state.current.days.length).toBe((dayInWeek + 1) % 7);
  });

  it("supports warning stages before threats become serious", () => {
    const s = run("grand-market-aggressive", "stages", 26).state;
    const ext = s.events.filter((e) => e.threadId === "extortion").map((e) => e.stage);
    expect(ext[0]).toBe(1);
    const firstWarning = s.events.find((e) => e.threadId === "extortion" && e.stage === 1)!;
    const firstDemand = s.events.find((e) => e.threadId === "extortion" && e.stage === 2);
    if (firstDemand) expect(firstDemand.day - firstWarning.day).toBeGreaterThanOrEqual(world.threads.find((t) => t.id === "extortion")!.minDwellDays);
  });

  it("lets threads cool off when conditions improve", () => {
    const initial = createInitialState(world, planOf("grand-market-aggressive"), { seed: "cool", startDay: START });
    const hot = runSimulation(world, initial, { weeks: 6 }).state;
    const peak = hot.threads["guild-pressure"]!.progress;
    expect(peak).toBeGreaterThan(0);
    const calmed = structuredClone(hot);
    calmed.plan = { ...calmed.plan, guild: "member" };
    calmed.business.hidden.guildRelation = 80;
    const later = runSimulation(world, calmed, { weeks: 6 }).state;
    expect(later.threads["guild-pressure"]!.progress).toBeLessThan(peak);
  });

  it("freezes a thread flagged for in-person play", () => {
    const { result: r, decision } = stepToDecision("grand-market-aggressive", "flag", 26, (x) => x.options.some((o) => o.id === "flag"));
    const p = decision!;
    expect(p).toBeDefined();
    const after = runSimulation(world, r.state, { untilDay: r.state.day + 13, resolutions: { [p.id]: "flag" }, pause: "never" }).state;
    const threadId = p.options.find((o) => o.id === "flag")!.effects.find((e) => e.kind === "thread")!;
    const id = threadId.kind === "thread" ? threadId.threadId : "";
    expect(after.threads[id]!.frozenUntilDay).toBeGreaterThan(r.state.day);
    expect(after.conditions.some((c) => c.id === `awaiting-session:${id}`)).toBe(true);
  });
});

describe("escalation is driven by decisions, not luck", () => {
  const runs = 12;
  const weeks = 26;
  const base = planOf("grand-market-aggressive");
  const secured = { ...base, security: { precautions: true, protectionPaymentCpPerWeek: 0 }, staff: [...base.staff!, { candidateId: "tam-greaves", role: "guard" as const, wageCpPerDay: 40 }] };
  const quiet = { ...base, advertisingCpPerWeek: 50, constructPublicity: "discreet" as const };
  const batch = runBatch(
    world,
    [
      { id: "base", label: "base", plan: base },
      { id: "secured", label: "secured", plan: secured },
      { id: "quiet", label: "quiet", plan: quiet },
      { id: "guild", label: "guild", plan: { ...base, guild: "member" as const, compliance: "full" as const, constructPublicity: "discreet" as const } },
      { id: "calm", label: "calm", plan: planOf("commons-compliant") },
      { id: "calm-showcase", label: "calm-showcase", plan: { ...planOf("commons-compliant"), constructPublicity: "showcased" as const } },
    ],
    { runs, weeks, startDay: START, seedPrefix: "esc" },
  );
  const reach = (id: string, thread: string, stage: number) => batch.summaries.find((s) => s.scenarioId === id)!.threadReach[thread]![stage]!;

  it("security arrangements reduce extortion escalation", () => {
    expect(reach("secured", "extortion", 2)).toBeLessThan(reach("base", "extortion", 2));
  });

  it("lower visibility reduces criminal and guild attention", () => {
    const peak = (id: string) => batch.runs[id]!.reduce((a, r) => a + r.peakCriminalAttention, 0) / runs;
    expect(peak("quiet")).toBeLessThan(peak("base"));
    expect(reach("quiet", "guild-pressure", 2)).toBeLessThanOrEqual(reach("base", "guild-pressure", 2));
  });

  it("guild membership and compliance prevent guild pressure and inspections", () => {
    expect(reach("guild", "guild-pressure", 2)).toBe(0);
    expect(reach("guild", "inspection", 2)).toBeLessThan(reach("base", "inspection", 2));
  });

  it("showcasing unlicensed constructs draws official attention even for a compliant business", () => {
    expect(reach("calm", "inspection", 1)).toBe(0);
    expect(reach("calm-showcase", "inspection", 1)).toBeGreaterThan(0);
  });
});
