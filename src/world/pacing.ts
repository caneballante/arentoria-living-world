/**
 * PROVISIONAL narrative pacing, in in-game days. Targets (per 52 weeks, see
 * docs/ASSUMPTIONS.md): a sound business sees ~6–10 player decisions, ~10–15 notable
 * report items and a few major moments; risky businesses roughly two to three times
 * as many, without the same crisis repeating endlessly.
 */
import { provisional } from "../engine/provenance";
import type { PacingConfig } from "../engine/types";

export const pacing: PacingConfig = {
  provenance: provisional("Pacing targets per in-game time; tune at the table."),
  minDaysBetweenPlayerDecisions: 21,
  quietDaysAfterMajor: 14,
  quietHazardMultiplier: 0.4,
  minDaysBetweenMajorEscalations: 14,
};
