import { describe, expect, it } from "vitest";
import { dateFromDay, dayFromDate } from "../src/engine/calendar";
import { expectedRetailDemand, seasonMultiplier, wholesalePrice } from "../src/engine/economy";
import { createInitialState, makeContext, simulateScenario } from "../src/engine/simulate";
import { unmodelledNeighborhoods } from "../src/world/neighborhoods";
import { planOf, START, world } from "./helpers";

const n = world.neighborhoods;
const ids = ["commons", "grand-market", "high-march", "shades", "stoneback", "scholarium", "outer-ward", "crown-ward"];

describe("the city's districts", () => {
  it("models every named district except Guildstrand", () => {
    expect(Object.keys(n).sort()).toEqual([...ids].sort());
    expect(unmodelledNeighborhoods).toEqual(["Guildstrand"]);
  });

  it("gives every district a local rival and a local crew", () => {
    for (const d of Object.values(n)) {
      const rival = world.actors.find((a) => a.id === d.rivalActorId);
      const crew = world.actors.find((a) => a.id === d.crewActorId);
      expect(rival?.kind, d.id).toBe("rival-business");
      expect(crew?.kind, d.id).toBe("criminal-crew");
      expect(rival?.neighborhoods, d.id).toContain(d.id);
      expect(crew?.neighborhoods, d.id).toContain(d.id);
    }
  });

  it("keeps district names canon and numbers labelled provisional", () => {
    for (const d of Object.values(n)) expect(d.provenance.status, d.id).toBe("canon");
    for (const id of ["shades", "stoneback", "scholarium", "outer-ward", "crown-ward"]) expect(n[id]!.provenance.note).toMatch(/provisional/);
  });
});

describe("district character", () => {
  const state = createInitialState(world, planOf("commons-compliant"), { seed: "d", startDay: START });
  const date = dateFromDay(world.calendar, START + 1);
  const withHidden = (patch: object) => ({ ...state, business: { ...state.business, hidden: { ...state.business.hidden, ...patch } } });
  const demand = (s: typeof state, id: string, d = date) => expectedRetailDemand(world, s, s.plan, n[id]!, world.channels.stall, d).expected;

  it("regulars matter more in the Scholarium and the Shades than in the Commons", () => {
    const lift = (id: string) => demand(withHidden({ loyalty: 80 }), id) / demand(withHidden({ loyalty: 0 }), id);
    expect(lift("scholarium")).toBeGreaterThan(lift("commons"));
    expect(lift("shades")).toBeGreaterThan(lift("commons"));
  });

  it("the Shades ignores strangers until the street knows them", () => {
    const growth = (id: string) => demand(withHidden({ visibility: 60 }), id) / demand(withHidden({ visibility: 0 }), id);
    expect(growth("shades")).toBeGreaterThan(growth("commons"));
  });

  it("the Scholarium thins out in the summer recess", () => {
    const summer = dateFromDay(world.calendar, dayFromDate(world.calendar, 941, 7, 3));
    expect(summer.season).toBe("summer");
    expect(seasonMultiplier(n.scholarium!, summer)).toBeLessThan(1);
    expect(seasonMultiplier(n.commons!, summer)).toBe(1);
  });

  it("Stoneback foremen place large orders more often, and bigger ones", () => {
    const largeOrder = world.events.find((e) => e.id === "large-order")!;
    const busy = withHidden({ reputation: 70, visibility: 60 });
    const at = (id: string) => largeOrder.hazard(makeContext(world, { ...busy, plan: { ...busy.plan, neighborhood: id } }, date)).probability;
    expect(at("stoneback")).toBeGreaterThan(at("commons") * 2);
    expect(n.stoneback!.largeOrders!.sizeMultiplier).toBeGreaterThan(1);
  });

  it("Crown Ward contracts pay close to list price", () => {
    const plan = { ...state.plan, quality: 4, priceCp: 12 };
    expect(wholesalePrice(world, n["crown-ward"]!, plan)).toBeCloseTo(12 * 0.95, 5);
    expect(n["crown-ward"]!.wholesale!.priceFraction!).toBeGreaterThan(world.assumptions.wholesale.priceFraction);
  });

  it("Crown Ward ministries only contract with fully compliant suppliers", () => {
    const base = planOf("crown-ward-catering");
    const accounts = (compliance: "full" | "basic") =>
      simulateScenario(world, { plan: { ...base, compliance }, seed: "contracts", weeks: 16, startDay: START }).state.business.wholesaleAccounts;
    expect(accounts("full")).toBeGreaterThan(accounts("basic"));
  });
});

describe("district plans", () => {
  it("each new district's starting plan makes money over a season", () => {
    for (const id of ["shades-local", "stoneback-yards", "scholarium-lunch", "outer-ward-rounds", "crown-ward-catering"]) {
      const r = simulateScenario(world, { plan: planOf(id), seed: "district", weeks: 26, startDay: START });
      const profit = r.state.weeks.reduce((a, w) => a + w.profitCp, 0);
      expect(profit, id).toBeGreaterThan(0);
    }
  });
});

describe("the DM's crews and churches", () => {
  it("draws each district's crew from its candidates, once per campaign", async () => {
    const { withCampaignCrew } = await import("../src/engine/simulate");
    const commons = n.commons!;
    const picks = new Set<string>();
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]) {
      const crew = withCampaignCrew(commons, seed).crewActorId;
      expect(commons.crewCandidates).toContain(crew);
      expect(withCampaignCrew(commons, seed).crewActorId).toBe(crew); // the same campaign keeps the same crew
      picks.add(crew);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("names the crew the campaign drew when trouble comes", () => {
    const state = createInitialState(world, planOf("commons-compliant"), { seed: "crew-name", startDay: START });
    const ctx = makeContext(world, state, dateFromDay(world.calendar, START));
    const name = world.actors.find((a) => a.id === ctx.neighborhood.crewActorId)!.name;
    expect(ctx.actorName(ctx.neighborhood.crewActorId)).toBe(name);
  });

  it("has all fifteen small-time crews, with their pool ids, kept below the major factions", () => {
    const crews = world.actors.filter((a) => a.kind === "criminal-crew");
    expect(crews).toHaveLength(15);
    for (let i = 1; i <= 15; i++) expect(crews.some((c) => c.provenance.note?.includes(`SC-${String(i).padStart(2, "0")}`))).toBe(true);
    expect(world.canon.some((f) => f.id === "small-operators")).toBe(true);
  });

  it("has the seven public churches, with Dawnfire underground", () => {
    const churches = world.actors.filter((a) => a.kind === "church").map((a) => a.name);
    expect(churches).toHaveLength(7);
    for (const g of ["Lathander", "Waukeen", "Tyr", "Sune", "Chauntea", "Gond", "Oghma"]) expect(churches.some((c) => c.includes(g))).toBe(true);
    expect(churches.some((c) => c.includes("Dawnfire"))).toBe(false);
    expect(world.canon.find((f) => f.id === "dawnfire-underground")?.provenance.status).toBe("canon");
  });
});
