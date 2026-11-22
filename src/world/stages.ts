/**
 * Business sizes: the DM's guard rails (22 Nov 2026). The party starts with one cart in
 * one district and one hire, and the business grows only when the DM unlocks a bigger
 * size. The limits are provisional; later sizes are still to be decided at the table.
 */
import { provisional } from "../engine/provenance";
import type { BusinessStage } from "../engine/types";

export const stages: Record<string, BusinessStage> = {
  "starting-out": {
    id: "starting-out",
    label: "Starting out",
    provenance: provisional("DM's guard rail: start small and grow. The 500-pie cap is provisional."),
    description: "One district, one street cart and one hire. Up to 500 pies a week, with the constructs at a steady pace. Bigger sizes are unlocked by the DM as the business grows.",
    outlets: { cart: 1 },
    maxStaff: 1,
    roles: ["vendor"],
    maxWeeklyProduction: 500,
    allowPushedWorkload: false,
    allowFestivalPush: false,
  },
  unrestricted: {
    id: "unrestricted",
    label: "Unrestricted (sandbox)",
    provenance: provisional("For strategy studies only: no limits."),
    description: "No limits. For comparing strategies in the sandbox, not for real play.",
    allowPushedWorkload: true,
    allowFestivalPush: true,
  },
};
