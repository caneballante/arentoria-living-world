import { describe, expect, it } from "vitest";
import { simulateScenario } from "../src/engine/simulate";
import { buildAllReports } from "../src/narrative/weekly-report";
import { buildDmView, buildPlayerView } from "../src/views";
import { planOf, run, START, world } from "./helpers";

const HIDDEN_KEYS = ["reputation", "loyalty", "visibility", "scrutiny", "guildRelation", "criminalAttention", "rivalHostility", "constructStrain", "hidden", "drivers", "dmText", "probability", "skimmed", "skimmedCp", "traits", "honesty", "threads", "basis", "effects", "morale", "competence"];

function keysDeep(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
    out.add(k);
    keysDeep(x, out);
  }
  return out;
}

describe("player and DM views", () => {
  const r = run("grand-market-aggressive", "views", 26);

  it("player view contains no hidden simulation state", () => {
    const keys = keysDeep(buildPlayerView(world, r));
    for (const k of HIDDEN_KEYS) expect(keys.has(k), `player view leaks "${k}"`).toBe(false);
  });

  it("player view omits events the players did not witness", () => {
    const view = buildPlayerView(world, r);
    const hiddenIds = r.state.events.filter((e) => !e.visibleToPlayers).map((e) => e.id);
    for (const id of hiddenIds) expect(view.events.some((e) => e.id === id)).toBe(false);
  });

  it("player pending decisions expose choices but not their mechanical effects", () => {
    const paused = simulateScenario(world, { plan: planOf("grand-market-aggressive"), seed: "views", weeks: 26, startDay: START, pause: "decisions" });
    const view = buildPlayerView(world, paused);
    expect(view.pending.length + paused.pending.filter((p) => p.authority === "dm").length).toBe(paused.pending.length);
    expect(keysDeep(view.pending).has("effects")).toBe(false);
  });

  it("DM view exposes hidden state and explains why it changed", () => {
    const dm = buildDmView(world, r);
    expect(dm.state.business.hidden.reputation).toBeTypeOf("number");
    expect(dm.explanations).toHaveLength(26);
    const w = dm.explanations[5]!;
    const rep = w.variables.find((v) => v.variable === "reputation")!;
    const sum = rep.drivers.reduce((a, d) => a + d.value, 0);
    expect(Math.abs(rep.from + sum - rep.to)).toBeLessThan(0.11); // drivers (incl. events) reconcile to rounding
  });

  it("every report line has a DM basis, and players see none of them", () => {
    const reports = buildAllReports(world, r.state);
    expect(reports).toHaveLength(26);
    for (const rep of reports) for (const l of rep.lines) expect(l.basis.length).toBeGreaterThan(0);
    const player = buildPlayerView(world, r);
    expect(JSON.stringify(player)).not.toContain("basis");
  });

  it("marks sandbox output as non-canon", () => {
    expect(buildPlayerView(world, r).notice).toMatch(/not campaign canon/);
    expect(r.state.branch).toBe("sandbox");
    expect(r.state.events.every((e) => e.provenance === "simulated")).toBe(true);
  });
});
