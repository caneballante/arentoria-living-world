import { describe, expect, it } from "vitest";
import { dateFromDay } from "../src/engine/calendar";
import { weekStats } from "../src/engine/dynamics";
import { dayShortfall, emptyLedger, operatingWeekdays, salesLimit } from "../src/engine/economy";
import type { BusinessPlanInput, ChannelType } from "../src/engine/plan";
import { createInitialState, runSimulation, simulateScenario } from "../src/engine/simulate";
import type { ChannelDayResult, DayRecord, WeekRecord, WorldState } from "../src/engine/types";
import { buildWeeklyReport } from "../src/narrative/weekly-report";
import { planOf, START, world } from "./helpers";

const k = world.assumptions.turnedAway;

/** One outlet's day, with sold = min(allocated, demand, capacity) as in the engine. */
function outlet(channel: ChannelType, allocated: number, demand: number, capacity: number): ChannelDayResult {
  const sold = Math.max(0, Math.min(allocated, demand, capacity));
  return { channel, allocated, demand, capacity, sold, priceCp: 5, revenueCp: sold * 5, unmet: demand - sold, limitedBy: salesLimit({ allocated, demand, sold }), factors: {} };
}
const day = (...channels: ChannelDayResult[]) => ({ produced: channels.reduce((a, c) => a + c.allocated, 0), channels });

describe("why customers were turned away (one day)", () => {
  it("whole bake gone: every outlet sold its share and pies ran out", () => {
    const s = dayShortfall(world, day(outlet("cart", 100, 130, 184), outlet("stall", 66, 110, 252)));
    expect(s.stock).toBe("sold-out");
    expect(s.ranOut).toEqual(["cart", "stall"]);
    expect(s.shortHanded).toEqual([]);
  });

  it("a handful of stray pies left still counts as sold out", () => {
    const s = dayShortfall(world, day(outlet("cart", 100, 130, 184), outlet("stall", 66, 66 - (k.leftoverMinPies - 1), 252)));
    expect(s.stock).toBe("sold-out");
  });

  it("allocation mismatch: the stall ran out while the cart had pies left (week 14, day 1 of the bug report)", () => {
    const s = dayShortfall(world, day(outlet("cart", 100, 76, 184), outlet("stall", 66, 110, 252)));
    expect(s.stock).toBe("allocation");
    expect(s.ranOut).toEqual(["stall"]);
    expect(s.leftover).toEqual({ cart: 24 });
    expect(s.turnedAway).toEqual({ stock: 44, hands: 0 });
  });

  it("pies left in the wholesale batch count as pies elsewhere; wholesale itself never turns customers away", () => {
    const s = dayShortfall(world, day(outlet("stall", 60, 110, 252), outlet("wholesale", 40, 25, 300)));
    expect(s.stock).toBe("allocation");
    expect(s.leftover).toEqual({ wholesale: 15 });
    expect(dayShortfall(world, day(outlet("cart", 100, 90, 184), outlet("wholesale", 20, 60, 300))).ranOut).toEqual([]);
  });

  it("too few hands: the cart still had pies but its sellers could not keep up", () => {
    const s = dayShortfall(world, day(outlet("cart", 120, 150, 80), outlet("stall", 66, 60, 252)));
    expect(s.stock).toBeUndefined();
    expect(s.shortHanded).toEqual(["cart"]);
    expect(s.turnedAway.hands).toBe(70);
  });

  it("nothing baked is not a sell-out", () => {
    expect(dayShortfall(world, day(outlet("cart", 0, 100, 184), outlet("stall", 0, 120, 252))).stock).toBe("no-bake");
  });

  it("ignores small shortfalls", () => {
    const s = dayShortfall(world, day(outlet("cart", 100, 100 + k.minCustomers - 1, 184), outlet("stall", 66, 60, 252)));
    expect(s.ranOut).toEqual([]);
    expect(s.shortHanded).toEqual([]);
  });

  it("classifies day records saved before the breakdown existed (no shortfall, no limitedBy)", () => {
    const legacy = (c: ChannelDayResult) => {
      const { unmet: _u, limitedBy: _l, ...rest } = c;
      return { ...rest, stockout: c.demand - c.sold >= 8 } as unknown as ChannelDayResult;
    };
    const days = [day(outlet("cart", 100, 76, 184), outlet("stall", 66, 110, 252)), day(outlet("cart", 100, 130, 184), outlet("stall", 66, 110, 252))].map(
      (d, i) => ({ day: i, operating: true, produced: d.produced, sold: d.channels.reduce((a, c) => a + c.sold, 0), waste: 0, channels: d.channels.map(legacy) }) as unknown as DayRecord,
    );
    const stats = weekStats(world, { index: 1, startDay: 0, days, ledger: emptyLedger(), cashStartCp: 0, hiddenStart: world.assumptions.initialHidden });
    expect(stats.turnedAwayDays).toBe(2);
    expect(stats.shortfall).toMatchObject({ soldOutDays: 1, allocationDays: 1, shortHandedDays: 0, ranOutAt: { stall: 1 }, leftOverAt: { cart: 24 } });
  });
});

/**
 * Run week by week, keeping each week's day records (stopping just before each week closes).
 * Only valid for plans whose rest day is the week's last day, which is asserted.
 */
function runKeepingDays(plan: BusinessPlanInput, seed: string, weeks: number) {
  let state: WorldState = createInitialState(world, plan, { seed, startDay: START });
  const out: { week: WeekRecord; days: DayRecord[] }[] = [];
  for (let i = 0; i < weeks; i++) {
    const endDay = state.day + 6;
    expect(operatingWeekdays(world, state.plan)).not.toContain(dateFromDay(world.calendar, endDay).weekday);
    state = runSimulation(world, state, { untilDay: endDay - 1 }).state;
    const days = structuredClone(state.current.days);
    state = runSimulation(world, state, { untilDay: endDay }).state;
    out.push({ week: state.weeks[state.weeks.length - 1]!, days });
  }
  return { state, weeks: out };
}

/** Ground truth from raw outlet numbers alone, independent of the engine's classification. */
function rawCauses(days: DayRecord[]) {
  let soldOut = 0;
  let ranOutWithPiesLeft = 0;
  for (const d of days) {
    const ranOut = d.channels.filter((c) => c.channel !== "wholesale" && c.sold === c.allocated && c.demand - c.sold >= Math.max(k.minCustomers, c.demand * k.minShareOfDemand));
    if (!ranOut.length || d.produced === 0) continue;
    if (d.produced - d.sold < k.leftoverMinPies) soldOut++;
    else ranOutWithPiesLeft++;
  }
  return { soldOut, ranOutWithPiesLeft };
}

const playerText = (state: WorldState, w: WeekRecord) => buildWeeklyReport(world, state, w).lines.map((l) => l.text);

describe("weekly report: turned-away customers", () => {
  it("never says 'sold out' in a week where pies went unsold and nothing actually sold out", () => {
    // Most of the bake goes to the cart, so the stall keeps running out while the cart has pies left.
    const plan = planOf("commons-compliant", { channels: [{ type: "cart", share: 0.8 }, { type: "stall", share: 0.2 }] });
    const { state, weeks } = runKeepingDays(plan, "skew", 26);
    let checked = 0;
    for (const { week, days } of weeks) {
      expect(days.reduce((a, d) => a + d.sold, 0), `week ${week.index} day records complete`).toBe(week.sold);
      const raw = rawCauses(days);
      const text = playerText(state, week);
      const soldOutLines = text.filter((t) => /sold out/i.test(t));
      if (raw.soldOut === 0) expect(soldOutLines, `week ${week.index}`).toEqual([]);
      else if (week.stockoutDays >= 2) expect(text).toContain(`Sold out early on ${raw.soldOut} day(s); customers were turned away.`);
      if (raw.ranOutWithPiesLeft > 0 && week.stockoutDays >= 2) {
        expect(text.some((t) => t.startsWith("The stall ran out early on ") && t.endsWith(" while the cart had pies left over.")), `week ${week.index}`).toBe(true);
      }
      if (week.waste > 0 && raw.soldOut === 0 && week.stockoutDays >= 2) checked++;
    }
    expect(checked, "weeks with unsold pies, turned-away customers and no real sell-out").toBeGreaterThanOrEqual(3);
  });

  it("reported case: Conservative Commons cart, seed pie-3, DM-only payouts, week 14", () => {
    const base = planOf("commons-compliant");
    const plan = { ...base, finance: { ...base.finance, payoutMode: "dm-only" as const } };
    const { state, weeks } = runKeepingDays(plan, "pie-3", 14);
    // Stepping week by week replays the same run as one straight run.
    const straight = simulateScenario(world, { plan, seed: "pie-3", weeks: 14, startDay: START, pause: "never" }).state.weeks;
    expect(weeks.map((x) => [x.week.sold, x.week.waste])).toEqual(straight.map((w) => [w.sold, w.waste]));

    const { week, days } = weeks[13]!;
    const raw = rawCauses(days);
    // The case still exercises the bug: unsold pies on days an outlet ran out. (If calibration moves this, pick another week.)
    expect(week.waste).toBeGreaterThan(0);
    expect(raw.ranOutWithPiesLeft).toBeGreaterThan(0);

    const text = playerText(state, week);
    expect(text).not.toContain(`Sold out early on ${week.stockoutDays} day(s); customers were turned away.`);
    expect(text).toContain(`Sold out early on ${raw.soldOut} day(s); customers were turned away.`);
    expect(text).toContain(`The stall ran out early on ${raw.ranOutWithPiesLeft} day(s) while the cart had pies left over.`);
    for (const l of buildWeeklyReport(world, state, week).lines) expect(l.basis.length, l.text).toBeGreaterThan(0);
  });

  it("weeks saved before causes were recorded fall back to a neutral line", () => {
    const r = simulateScenario(world, { plan: planOf("commons-compliant"), seed: "pie-3", weeks: 14, startDay: START, pause: "never" });
    const { shortfall: _s, ...legacy } = r.state.weeks[13]!;
    const text = playerText(r.state, { ...legacy, stockoutDays: 3 } as WeekRecord);
    expect(text).toContain("Customers were turned away on 3 day(s).");
    expect(text.filter((t) => /sold out|ran out/i.test(t))).toEqual([]);
  });
});
