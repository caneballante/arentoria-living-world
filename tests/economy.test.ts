import { describe, expect, it } from "vitest";
import { dateFromDay } from "../src/engine/calendar";
import { expectedRetailDemand, fairPrice, hotFoodFactor, ledgerCosts, ledgerIncome, priceFactor, qualityFactor } from "../src/engine/economy";
import { createInitialState } from "../src/engine/simulate";
import { planOf, run, START, world } from "./helpers";

const n = world.neighborhoods;

describe("demand model", () => {
  const state = createInitialState(world, planOf("commons-compliant"), { seed: "d", startDay: START });
  const date = dateFromDay(world.calendar, START + 1);
  const demandAt = (patch: object) => {
    const plan = { ...state.plan, ...patch };
    return expectedRetailDemand(world, { ...state, plan }, plan, n.commons!, world.channels.cart, date).expected;
  };

  it("falls as price rises", () => {
    const prices = [2, 3, 4, 5, 6, 8, 10];
    const d = prices.map((p) => demandAt({ priceCp: p }));
    for (let i = 1; i < d.length; i++) expect(d[i]!).toBeLessThan(d[i - 1]!);
  });

  it("rises with visibility, reputation and cold weather", () => {
    const base = demandAt({});
    const visible = expectedRetailDemand(world, { ...state, business: { ...state.business, hidden: { ...state.business.hidden, visibility: 80 } } }, state.plan, n.commons!, world.channels.cart, date).expected;
    const famous = expectedRetailDemand(world, { ...state, business: { ...state.business, hidden: { ...state.business.hidden, reputation: 80 } } }, state.plan, n.commons!, world.channels.cart, date).expected;
    expect(visible).toBeGreaterThan(base);
    expect(famous).toBeGreaterThan(base);
    expect(hotFoodFactor(world, 0)).toBeGreaterThan(hotFoodFactor(world, 15));
  });

  it("gives each neighborhood a distinct quality and price profile", () => {
    // High March rewards quality far more than the Commons, and punishes scrap-tier pies.
    const hmGain = qualityFactor(n["high-march"]!, 5) / qualityFactor(n["high-march"]!, 3);
    const coGain = qualityFactor(n.commons!, 5) / qualityFactor(n.commons!, 3);
    expect(hmGain).toBeGreaterThan(coGain * 1.5);
    expect(qualityFactor(n["high-march"]!, 1)).toBeLessThan(0.15);
    // The same price hurts Commons demand more than High March demand.
    expect(priceFactor(world, n.commons!, world.channels.cart, 8)).toBeLessThan(priceFactor(world, n["high-march"]!, world.channels.cart, 8) * 0.5);
    expect(fairPrice(world, n["high-march"]!, 4)).toBeGreaterThan(fairPrice(world, n.commons!, 4) * 1.5);
  });

  it("has an interior profit-maximizing price (not 'always cheaper' or 'always dearer')", () => {
    const unitCost = 2.1;
    const profits = [3, 4, 5, 6, 7, 9, 12].map((p) => ({ p, profit: (p - unitCost) * demandAt({ priceCp: p }) }));
    const best = profits.reduce((a, b) => (b.profit > a.profit ? b : a));
    expect(best.p).toBeGreaterThan(3);
    expect(best.p).toBeLessThan(12);
  });
});

describe("accounting", () => {
  const r = run("commons-compliant", "ledger", 26);
  const s = r.state;
  const plan = s.plan;

  it("simulates exactly 26 weeks of 7 days", () => {
    expect(s.weeks).toHaveLength(26);
    expect(s.day - s.startDay).toBe(26 * 7);
    for (const w of s.weeks) expect(w.endDay - w.startDay).toBe(6);
  });

  it("reconciles cash: start + income − costs − owner draws = end", () => {
    const startup = world.assumptions.guild.associateInitiationCp;
    let cash = plan.startingCapitalCp - startup;
    for (const w of s.weeks) {
      const startupThisWeek = w.index === 1 ? startup : 0;
      cash += ledgerIncome(w.ledger) - (ledgerCosts(w.ledger) - startupThisWeek) - w.ownerDrawCp;
      expect(Math.abs(cash - w.cashEndCp)).toBeLessThan(2);
    }
    expect(Math.abs(cash - s.business.cashCp)).toBeLessThan(2);
  });

  it("conserves pies: produced = sold + waste, and never exceeds construct capacity", () => {
    const cap = world.assumptions.constructs.count * world.assumptions.constructs.piesPerDayEach * 7;
    for (const w of s.weeks) {
      expect(w.produced).toBe(w.sold + w.waste);
      expect(w.produced).toBeLessThanOrEqual(cap);
    }
  });

  it("reports profit = income − costs each week", () => {
    for (const w of s.weeks) expect(w.profitCp).toBe(ledgerIncome(w.ledger) - ledgerCosts(w.ledger));
  });

  it("records skimming separately from what the party sees", () => {
    const sk = run("low-price-volume", "ledger", 12).state;
    const skimmed = sk.weeks.reduce((a, w) => a + w.skimmedCp, 0);
    expect(skimmed).toBeGreaterThan(0);
    // Revenue in the ledger is what reached the cash box (after skimming).
    const trueRevenue = sk.weeks.reduce((a, w) => a + w.revenueCp, 0) + skimmed;
    expect(trueRevenue).toBeGreaterThan(sk.weeks.reduce((a, w) => a + w.revenueCp, 0));
  });
});

describe("seasonal effects", () => {
  it("ingredient prices and weather vary across a season", () => {
    const s = run("commons-compliant", "season", 26).state;
    const idx = s.weeks.map((w) => w.avgPriceIndex);
    expect(Math.max(...idx) - Math.min(...idx)).toBeGreaterThan(0.05);
    const temps = s.weeks.map((w) => w.weather.avgTempC);
    expect(temps[0]! - temps[temps.length - 1]!).toBeGreaterThan(8);
    expect(s.weeks.some((w) => w.festivals.includes("Harvest Fair"))).toBe(true);
  });
});
