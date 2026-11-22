import { describe, expect, it } from "vitest";
import { dateFromDay, dayFromDate } from "../src/engine/calendar";
import { mean } from "../src/engine/math";
import type { WeatherState } from "../src/engine/types";
import { ingredientPriceIndex, initialWeather, nextWeather } from "../src/engine/weather";
import { world } from "./helpers";

function series(seed: string, start: number, days: number): WeatherState[] {
  let w = initialWeather(world.climate, world.calendar, dateFromDay(world.calendar, start));
  const out: WeatherState[] = [];
  for (let d = start; d < start + days; d++) {
    w = nextWeather(world.climate, world.calendar, w, dateFromDay(world.calendar, d), seed);
    out.push(w);
  }
  return out;
}

describe("weather", () => {
  it("is deterministic for a seed", () => {
    expect(series("w", 200, 60)).toEqual(series("w", 200, 60));
    expect(series("w", 200, 60)).not.toEqual(series("x", 200, 60));
  });

  it("is colder in winter than summer", () => {
    const winter = series("w", dayFromDate(world.calendar, 940, 1, 1), 56).map((x) => x.temperatureC);
    const summer = series("w", dayFromDate(world.calendar, 940, 7, 1), 56).map((x) => x.temperatureC);
    expect(mean(summer) - mean(winter)).toBeGreaterThan(12);
  });

  it("has persistence: temperature anomalies and wet spells are autocorrelated", () => {
    const s = series("persist", 0, 365 * 3);
    const a = s.map((x) => x.anomalyC);
    const m = mean(a);
    let num = 0,
      den = 0;
    for (let i = 1; i < a.length; i++) {
      num += (a[i]! - m) * (a[i - 1]! - m);
      den += (a[i - 1]! - m) ** 2;
    }
    expect(num / den).toBeGreaterThan(0.5);
    const wet = s.map((x) => ["rain", "storm", "snow"].includes(x.condition));
    const pWet = wet.filter(Boolean).length / wet.length;
    let wetAfterWet = 0,
      wetDays = 0;
    for (let i = 1; i < wet.length; i++) if (wet[i - 1]) {
      wetDays++;
      if (wet[i]) wetAfterWet++;
    }
    expect(wetAfterWet / wetDays).toBeGreaterThan(pWet + 0.1);
  });

  it("only snows in the cold", () => {
    for (const w of series("snow", 0, 365 * 2)) if (w.condition === "snow") expect(w.temperatureC).toBeLessThan(world.climate.snowBelowC);
  });

  it("makes meat cheapest around autumn slaughter", () => {
    const flat = { meatShock: 0, grainShock: 0 };
    const autumn = ingredientPriceIndex(world.market, world.calendar, flat, 280);
    const spring = ingredientPriceIndex(world.market, world.calendar, flat, 97);
    expect(autumn).toBeLessThan(spring);
  });
});
