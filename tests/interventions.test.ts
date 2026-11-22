import { describe, expect, it } from "vitest";
import { applyIntervention, createInitialState, runSimulation } from "../src/engine/simulate";
import { planOf, START, world } from "./helpers";

describe("World Intervention Layer (commit point)", () => {
  const initial = createInitialState(world, planOf("grand-market-aggressive"), { seed: "int", startDay: START });
  const midSeason = runSimulation(world, initial, { weeks: 6 }).state;

  it("applies approved structured effects and records cause, authority and effects", () => {
    const before = midSeason.business.hidden.criminalAttention;
    const { state, change } = applyIntervention(world, midSeason, {
      authority: "dm",
      description: "Party intimidated the crew threatening the delivery driver (approved at the table).",
      refId: "session-12-freeform-3",
      recordedAt: "2026-11-21T19:30:00Z",
      effects: [
        { kind: "adjust", variable: "criminalAttention", delta: -20 },
        { kind: "thread", threadId: "extortion", setProgress: 0, setStage: 0 },
        { kind: "reveal", topic: "street", text: "The crew has backed off — for now." },
        { kind: "schedule", eventId: "large-order-delivery", inDays: 5, data: { qty: 100, priceCp: 6, who: "a grateful neighbor" } },
      ],
    });
    expect(state.business.hidden.criminalAttention).toBe(Math.max(0, before - 20));
    expect(state.threads.extortion!.stage).toBe(0);
    expect(state.knowledge.at(-1)?.text).toContain("backed off");
    expect(state.scheduled.some((s) => s.eventId === "large-order-delivery")).toBe(true);
    expect(change.authority).toBe("dm");
    expect(change.cause).toEqual({ kind: "intervention", refId: "session-12-freeform-3" });
    expect(change.effects).toHaveLength(4);
    expect(change.recordedAt).toBe("2026-11-21T19:30:00Z");
    expect(state.history.at(-1)).toEqual(change);
  });

  it("does not mutate the original state", () => {
    const before = JSON.stringify(midSeason);
    applyIntervention(world, midSeason, { authority: "dm", description: "noop", effects: [{ kind: "adjust", variable: "reputation", delta: 5 }] });
    expect(JSON.stringify(midSeason)).toBe(before);
  });

  it("validates plan changes made through interventions", () => {
    expect(() =>
      applyIntervention(world, midSeason, { authority: "players", description: "bad plan", effects: [{ kind: "plan", patch: { priceCp: -3 }, note: "invalid" }] }),
    ).toThrow();
    const { state } = applyIntervention(world, midSeason, {
      authority: "players",
      description: "Players vote to join the guild and hire a guard",
      effects: [
        {
          kind: "plan",
          patch: { guild: "member", staff: [...midSeason.plan.staff, { candidateId: "tam-greaves", role: "guard", wageCpPerDay: 40 }] },
          note: "Vote passed",
        },
      ],
    });
    expect(state.plan.guild).toBe("member");
    expect(state.business.staff.some((s) => s.id === "tam-greaves")).toBe(true);
  });

  it("subsequent simulation is deterministic after an intervention", () => {
    const { state } = applyIntervention(world, midSeason, { authority: "dm", description: "x", effects: [{ kind: "adjust", variable: "visibility", delta: 10 }] });
    const a = runSimulation(world, state, { weeks: 4 });
    const b = runSimulation(world, state, { weeks: 4 });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
