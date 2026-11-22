import { describe, expect, it } from "vitest";
import { createInitialState, runSimulation } from "../src/engine/simulate";
import { InMemoryRepository } from "../src/persistence/repository";
import { planOf, START, world } from "./helpers";

describe("persistence boundary", () => {
  it("refuses canonical snapshots without DM approval", async () => {
    const repo = new InMemoryRepository(() => "2026-11-22T00:00:00Z");
    const state = createInitialState(world, planOf("commons-compliant"), { seed: "p", startDay: START });
    await expect(repo.saveSnapshot({ campaignId: "c1", branch: { kind: "canon" }, label: "x", day: START, seed: "p", createdBy: "player-1" }, state)).rejects.toThrow(/approval/);
  });

  it("keeps sandbox branches separate from canon and replays from a stored checkpoint", async () => {
    const repo = new InMemoryRepository(() => "2026-11-22T00:00:00Z");
    const initial = createInitialState(world, planOf("commons-compliant"), { seed: "p", startDay: START });
    const canon = await repo.saveSnapshot({ campaignId: "c1", branch: { kind: "canon" }, label: "Session 12 start", day: START, seed: "p", createdBy: "dm", approvedBy: "dm" }, initial);
    const sandboxRun = runSimulation(world, initial, { weeks: 4 }).state;
    await repo.saveSnapshot({ campaignId: "c1", branch: { kind: "sandbox", name: "what-if" }, label: "what if", day: sandboxRun.day, seed: "p", createdBy: "dm", parentId: canon.id }, sandboxRun);

    const latestCanon = await repo.latest("c1", { kind: "canon" });
    expect(latestCanon?.meta.id).toBe(canon.id);
    expect(latestCanon?.state.day).toBe(START);

    const replay = runSimulation(world, latestCanon!.state, { weeks: 4 }).state;
    expect(JSON.stringify(replay)).toBe(JSON.stringify(sandboxRun));
  });
});
