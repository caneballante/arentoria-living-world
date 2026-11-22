/**
 * Weather and seasonal market conditions.
 *
 * Temperature = seasonal baseline + an AR(1) anomaly (persistence gives multi-day
 * cold snaps and warm spells). Precipitation is a two-state Markov chain whose
 * transition probabilities vary by season, so wet weather comes in spells.
 * Ingredient prices follow seasonal curves plus slowly drifting AR(1) shocks.
 */

import { daysInYear, type CalendarConfig, type CalendarDate } from "./calendar";
import { rngFor } from "./rng";
import type { ClimateConfig, MarketConfig, MarketState, WeatherCondition, WeatherState } from "./types";

export function baselineTemperature(climate: ClimateConfig, cal: CalendarConfig, dayOfYear: number): number {
  const len = daysInYear(cal);
  return climate.meanTempC - climate.amplitudeC * Math.cos((2 * Math.PI * (dayOfYear - climate.coldestDayOfYear)) / len);
}

export function initialWeather(climate: ClimateConfig, cal: CalendarConfig, date: CalendarDate): WeatherState {
  return { condition: "cloudy", temperatureC: baselineTemperature(climate, cal, date.dayOfYear), anomalyC: 0 };
}

export function nextWeather(
  climate: ClimateConfig,
  cal: CalendarConfig,
  prev: WeatherState,
  date: CalendarDate,
  seed: string,
): WeatherState {
  const rng = rngFor(seed, "weather", date.absoluteDay);
  const anomalyC = climate.anomalyPersistence * prev.anomalyC + rng.normal(0, climate.anomalyShockSd);
  const temperatureC = Math.round((baselineTemperature(climate, cal, date.dayOfYear) + anomalyC) * 10) / 10;
  const wasWet = prev.condition === "rain" || prev.condition === "storm" || prev.condition === "snow";
  const pWet = wasWet ? climate.wetGivenWet[date.season] : climate.wetGivenDry[date.season];
  let condition: WeatherCondition;
  if (rng.chance(pWet)) {
    const stormy = rng.chance(climate.stormShare[date.season]);
    if (temperatureC < climate.snowBelowC) condition = "snow";
    else condition = stormy ? "storm" : "rain";
  } else {
    condition = rng.chance(climate.cloudyShareOfDry) ? "cloudy" : "clear";
  }
  return { condition, temperatureC, anomalyC };
}

export function nextMarket(market: MarketConfig, prev: MarketState, day: number, seed: string): MarketState {
  const rng = rngFor(seed, "market", day);
  return {
    meatShock: market.meat.shockPersistence * prev.meatShock + rng.normal(0, market.meat.shockSd),
    grainShock: market.grain.shockPersistence * prev.grainShock + rng.normal(0, market.grain.shockSd),
  };
}

/** Composite ingredient price index (1.0 = typical). */
export function ingredientPriceIndex(market: MarketConfig, cal: CalendarConfig, state: MarketState, dayOfYear: number): number {
  const len = daysInYear(cal);
  const seasonal = (cfg: { amplitude: number; cheapestDayOfYear: number }) =>
    1 - cfg.amplitude * Math.cos((2 * Math.PI * (dayOfYear - cfg.cheapestDayOfYear)) / len);
  const meat = seasonal(market.meat) * Math.exp(state.meatShock);
  const grain = seasonal(market.grain) * Math.exp(state.grainShock);
  return market.meatShareOfIngredients * meat + (1 - market.meatShareOfIngredients) * grain;
}

export function fuelPriceIndex(market: MarketConfig, cal: CalendarConfig, dayOfYear: number): number {
  const len = daysInYear(cal);
  return 1 + market.fuel.amplitude * Math.cos((2 * Math.PI * (dayOfYear - market.fuel.dearestDayOfYear)) / len);
}
