/**
 * The business account: the party's pie money, kept apart from their own purses.
 * Money enters through trading and leaves through running costs, one-off events and
 * DM-recorded withdrawals. The account should keep an operating floor (a few weeks of
 * running costs); anything above it is "safe to withdraw".
 */
import { qualityTierCost, supplierCreditLimitCp, weeklyFixedCosts } from "./economy";
import type { AccountStatus, Cp, WorldDefinition, WorldState } from "./types";

export interface AccountSummary {
  location: string;
  balanceCp: Cp;
  /** Weekly running costs the floor is based on. */
  weeklyRunningCostsCp: Cp;
  floorCp: Cp;
  safeToWithdrawCp: Cp;
  creditLimitCp: Cp;
  status: AccountStatus;
  withdrawnCp: Cp;
  depositedCp: Cp;
}

/** Typical weekly running costs: fixed costs, wages and ingredients for the planned output. */
export function weeklyRunningCostsCp(world: WorldDefinition, state: WorldState): Cp {
  const plan = state.plan;
  const ingredients = plan.weeklyProduction * (qualityTierCost(world, plan.quality) + world.assumptions.fuelCostPerPieCp);
  const fixed = weeklyFixedCosts(world, state, ingredients / 7).reduce((a, l) => a + l.amountCp, 0);
  const wages = state.business.staff.reduce((a, s) => a + s.wageCpPerDay, 0) * plan.operatingDays;
  return Math.round(fixed + wages + ingredients);
}

export function accountStatusOf(balanceCp: Cp, floorCp: Cp, creditLimitCp: Cp): AccountStatus {
  if (balanceCp < -creditLimitCp) return "cut-off";
  if (balanceCp < 0) return "overdrawn";
  if (balanceCp < floorCp) return "thin";
  return "healthy";
}

export function accountSummary(world: WorldDefinition, state: WorldState): AccountSummary {
  const running = weeklyRunningCostsCp(world, state);
  const floorCp = Math.round(running * world.assumptions.account.operatingFloorWeeks);
  const creditLimitCp = Math.round(supplierCreditLimitCp(world, state.plan));
  const balanceCp = state.business.cashCp;
  return {
    location: state.business.account.location,
    balanceCp,
    weeklyRunningCostsCp: running,
    floorCp,
    safeToWithdrawCp: Math.max(0, balanceCp - floorCp),
    creditLimitCp,
    status: accountStatusOf(balanceCp, floorCp, creditLimitCp),
    withdrawnCp: state.business.account.withdrawnCp,
    depositedCp: state.business.account.depositedCp,
  };
}
