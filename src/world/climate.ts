/**
 * PROVISIONAL climate and ingredient-market assumptions for Arentoria.
 * Numbers describe a temperate city with wet autumns and cold, occasionally snowy
 * winters. None of this is canon; tune freely.
 */
import { provisional } from "../engine/provenance";
import type { ClimateConfig, MarketConfig } from "../engine/types";

export const arentoriaClimate: ClimateConfig = {
  provenance: provisional("Temperate maritime-continental guess; adjust to campaign geography."),
  meanTempC: 10.5,
  amplitudeC: 9.5,
  coldestDayOfYear: 21,
  anomalyPersistence: 0.75,
  anomalyShockSd: 2.2,
  wetGivenDry: { spring: 0.3, summer: 0.18, autumn: 0.33, winter: 0.3 },
  wetGivenWet: { spring: 0.55, summer: 0.45, autumn: 0.62, winter: 0.6 },
  stormShare: { spring: 0.1, summer: 0.15, autumn: 0.2, winter: 0.15 },
  snowBelowC: 1,
  cloudyShareOfDry: 0.45,
  footTraffic: { clear: 1, cloudy: 0.97, rain: 0.72, storm: 0.45, snow: 0.68 },
  transportDisruption: { clear: 0, cloudy: 0, rain: 0.15, storm: 0.55, snow: 0.6 },
};

export const arentoriaMarket: MarketConfig = {
  provenance: provisional("Seasonal ingredient prices: meat cheapest at autumn slaughter, grain after harvest, fuel dearest in midwinter."),
  meat: { amplitude: 0.1, cheapestDayOfYear: 280, shockPersistence: 0.97, shockSd: 0.006 },
  grain: { amplitude: 0.12, cheapestDayOfYear: 240, shockPersistence: 0.97, shockSd: 0.005 },
  meatShareOfIngredients: 0.6,
  fuel: { amplitude: 0.25, dearestDayOfYear: 21 },
};
