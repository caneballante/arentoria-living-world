/**
 * Pacing, response windows and loop resolution. Targets are per in-game time (not per
 * session) and are documented in docs/ASSUMPTIONS.md. These are design guard rails:
 * if a calibration change breaks them, treat it as a design question.
 */
import { describe, expect, it } from "vitest";
import { runBatch } from "../src/analysis/batch";
import { applyIntervention, createInitialState, runSimulation, simulateScenario } from "../src/engine/simulate";
import { scenarios } from "../src/world";
import { planOf, run, START, stepToDecision, world } from "./helpers";

describe("response windows", () => {
  it("a decision that can wait does not stop the clock until its deadline", () => {
    const { result, decision } = stepToDecision("commons-compliant", "window", 26, (p) => p.dueDay > p.day);
    expect(decision).toBeDefined();
    // The run kept going after the decision arose and stopped at the end of its due day.
    expect(result.state.day - 1).toBe(decision!.dueDay);
  });

  it("an early answer takes effect at the deadline, exactly as a late answer would", () => {
    const { resolutions, decision } = stepToDecision("commons-compliant", "early", 26, (p) => p.dueDay > p.day && p.options.length > 1);
    const choice = decision!.options[1]!.id;
    const answered = { ...resolutions, [decision!.id]: choice };
    // Answer given up-front (before the decision even exists) vs. answer given at the pause.
    const early = simulateScenario(world, { plan: planOf("commons-compliant"), seed: "early", weeks: 26, startDay: START, resolutions: answered });
    const paused = simulateScenario(world, { plan: planOf("commons-compliant"), seed: "early", weeks: 26, startDay: START, pause: "decisions", resolutions });
    const resumed = runSimulation(world, paused.state, { untilDay: START + 26 * 7 - 1, resolutions: answered });
    const change = early.state.history.find((h) => h.cause.refId === decision!.id)!;
    expect(change.day).toBe(decision!.dueDay);
    expect(early.state.events.find((e) => e.decisionId === decision!.id)?.resolution?.optionId).toBe(choice);
    expect(JSON.stringify(resumed.state.weeks)).toBe(JSON.stringify(early.state.weeks));
  });

  it("an unanswered decision falls back to the standing order at its deadline", () => {
    const s = run("commons-compliant", "lapse", 26).state;
    const lapsed = s.history.filter((h) => h.description.endsWith("(no answer by the deadline)"));
    expect(lapsed.length).toBeGreaterThan(0);
    for (const h of lapsed) expect(h.authority).toBe("standing-order");
  });
});

describe("pacing", () => {
  it("spaces opportunity/dilemma decisions at least the configured number of days apart", () => {
    const paced = new Set(world.events.filter((d) => d.pacing === "decision").map((d) => d.id));
    for (const id of ["commons-compliant", "low-price-volume", "high-march-luxury"]) {
      const s = run(id, "spacing", 52).state;
      const days = s.events.filter((e) => paced.has(e.eventId) && e.decisionId).map((e) => e.day);
      for (let i = 1; i < days.length; i++) expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(world.pacing.minDaysBetweenPlayerDecisions);
    }
  });

  it("damps adverse random events right after a major event, and says so", () => {
    let seen = false;
    for (let i = 0; i < 20 && !seen; i++) {
      const s = run("grand-market-aggressive", `quiet-${i}`, 52).state;
      seen = s.events.some((e) => e.drivers?.some((d) => d.label.startsWith("Quiet spell after a major event")));
    }
    expect(seen).toBe(true);
  });
});

describe("threats resolve instead of looping", () => {
  it("a second refusal with real security makes the crew back off", () => {
    const plan = planOf("grand-market-aggressive", { security: { precautions: true, protectionPaymentCpPerWeek: 0 } });
    const s = run(plan, "defy", 52).state;
    const reprisals = s.events.filter((e) => e.eventId === "extortion:stage-4");
    if (reprisals.length >= 2) {
      expect(s.conditions.some((c) => c.id === "stood-up-to-crew") || s.knowledge.some((k) => k.text.includes("more trouble than we're worth"))).toBe(true);
    }
    expect(reprisals.length).toBeLessThanOrEqual(3);
  });

  const batch = runBatch(world, scenarios, { runs: 12, weeks: 52, startDay: START, seedPrefix: "pace" });
  const sum = (id: string) => batch.summaries.find((s) => s.scenarioId === id)!;

  it("no situation repeats the same stage more than three times a year", () => {
    for (const s of batch.summaries) expect(s.maxStageRepeats.p90, s.scenarioId).toBeLessThanOrEqual(3);
  });

  it("sound plans meet the cadence targets: regular choices, ordinary weeks, a few big moments", () => {
    for (const sc of scenarios.filter((x) => x.quality === "sound")) {
      const s = sum(sc.id);
      expect(s.playerDecisions.mean, `${sc.id} decisions`).toBeGreaterThanOrEqual(5);
      expect(s.playerDecisions.mean, `${sc.id} decisions`).toBeLessThanOrEqual(14);
      expect(s.longestQuietWeeks.mean, `${sc.id} quiet`).toBeLessThanOrEqual(12);
      expect(s.majorMoments.mean, `${sc.id} majors`).toBeLessThanOrEqual(5);
      expect(s.notableEvents.mean, `${sc.id} notable`).toBeLessThanOrEqual(18);
    }
  });

  it("risky plans are busier but not a crisis every week", () => {
    for (const id of ["grand-market-aggressive", "low-price-volume"]) {
      const s = sum(id);
      expect(s.majorMoments.mean).toBeGreaterThan(sum("commons-compliant").majorMoments.mean);
      expect(s.majorMoments.mean).toBeLessThanOrEqual(12);
    }
  });
});

describe("plan changes between sessions", () => {
  it("a plan revision scheduled for a day equals pausing there and applying it as an intervention", () => {
    const plan = planOf("commons-compliant");
    const revised = { ...plan, priceCp: 6, advertisingCpPerWeek: 120 };
    const day = START + 40;
    const iv = { day, authority: "players" as const, description: "Plan revised", effects: [{ kind: "plan" as const, patch: revised, note: "Revised between sessions" }] };
    const scheduled = simulateScenario(world, { plan, seed: "revise", weeks: 12, startDay: START, interventions: [iv] });

    const first = runSimulation(world, createInitialState(world, plan, { seed: "revise", startDay: START }), { untilDay: day - 1 });
    const applied = applyIntervention(world, first.state, { authority: "players", description: "Plan revised", refId: `scheduled-${day}`, effects: iv.effects }).state;
    const rest = runSimulation(world, applied, { untilDay: START + 12 * 7 - 1 });
    expect(JSON.stringify(rest.state)).toBe(JSON.stringify(scheduled.state));
    expect(scheduled.state.plan.priceCp).toBe(6);
    expect(scheduled.state.history.some((h) => h.cause.kind === "intervention" && h.day === day)).toBe(true);
  });

  it("fills a vacancy when a seller leaves (standing order)", () => {
    const plan = planOf("commons-compliant");
    const day = START + 20;
    const iv = { day, authority: "players" as const, description: "Pell leaves", effects: [{ kind: "plan" as const, patch: { staff: plan.staff!.filter((s) => s.candidateId !== "pell-marrow") }, note: "Pell left" }] };
    const s = simulateScenario(world, { plan, seed: "vacancy", weeks: 8, startDay: START, interventions: [iv] }).state;
    expect(s.events.some((e) => e.eventId === "vacancy-filled")).toBe(true);
    expect(s.plan.staff.filter((x) => x.role === "vendor").length).toBe(2);
  });
});

describe("advancing the clock", () => {
  it("'until something needs the party' stops at the first decision or major event, then moves past it", () => {
    const plan = planOf("commons-compliant");
    const cap = 7 * 26;
    const first = simulateScenario(world, { plan, seed: "until", weeks: 26, days: cap, startDay: START, stopWhenNeededAfterDay: START - 1 });
    expect(first.status).toBe("paused");
    const trigger = first.pausedOnEvent!;
    expect(trigger.decisionId !== undefined || trigger.severity === "major").toBe(true);
    expect(first.state.day - 1).toBe(trigger.day);
    // Nothing earlier qualified.
    expect(first.state.events.filter((e) => e.id !== trigger.id && (e.decisionId || e.severity === "major"))).toHaveLength(0);
    // Continue from that day: the same moment does not stop the clock again.
    const second = simulateScenario(world, { plan, seed: "until", weeks: 26, days: cap, startDay: START, stopWhenNeededAfterDay: trigger.day, acknowledged: [trigger.id] });
    if (second.status === "paused" && second.pausedOnEvent) expect(second.pausedOnEvent.day).toBeGreaterThan(trigger.day);
  });

  it("the digest summarizes exactly the period advanced", async () => {
    const { buildDigest } = await import("../src/narrative/digest");
    const s = run("grand-market-aggressive", "digest", 12).state;
    const from = START + 28;
    const to = START + 12 * 7 - 1;
    const d = buildDigest(world, s, from, to);
    expect(d.days).toBe(to - from + 1);
    const sold = s.weeks.filter((w) => w.startDay >= from && w.endDay <= to).reduce((a, w) => a + w.sold, 0);
    expect(d.lines[0]!.text).toContain(`sold ${sold.toLocaleString()} pies`);
    const inRange = s.events.filter((e) => e.day >= from && e.day <= to && e.visibleToPlayers && e.severity !== "minor");
    const outRange = s.events.filter((e) => (e.day < from || e.day > to) && e.visibleToPlayers && e.severity !== "minor");
    for (const e of inRange) expect(d.lines.some((l) => l.text.includes(e.playerText))).toBe(true);
    for (const e of outRange) expect(d.lines.some((l) => l.text.includes(`— ${e.playerText}`))).toBe(false);
  });
});
