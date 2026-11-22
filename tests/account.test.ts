import { afterEach, describe, expect, it } from "vitest";
import { accountSummary } from "../src/engine/account";
import { ledgerCosts, ledgerIncome } from "../src/engine/economy";
import { createInitialState, runSimulation, simulateScenario, type ScheduledIntervention } from "../src/engine/simulate";
import { buildPlayerView } from "../src/views";
import { planOf, START, world } from "./helpers";

const withdraw = (day: number, gp: number, refId: string): ScheduledIntervention => ({
  day,
  authority: "dm",
  refId,
  description: "Withdrawal recorded by the DM",
  effects: [{ kind: "account", action: "withdraw", amountCp: gp * 100, note: "Party withdrawal" }],
});
const deposit = (day: number, gp: number, refId: string): ScheduledIntervention => ({
  day,
  authority: "dm",
  refId,
  description: "Deposit recorded by the DM",
  effects: [{ kind: "account", action: "deposit", amountCp: gp * 100, note: "Party deposit" }],
});

describe("business account", () => {
  const plan = planOf("commons-compliant", { finance: { reserveTargetCp: 2500, ownerDrawShare: 0, payoutMode: "dm-only", reinvestAdvertisingShare: 0.1 } });

  it("withdrawals and deposits move money without counting as profit or loss", () => {
    const base = simulateScenario(world, { plan, seed: "acct", weeks: 8, startDay: START }).state;
    const moved = simulateScenario(world, { plan, seed: "acct", weeks: 8, startDay: START, interventions: [withdraw(START + 20, 10, "w1"), deposit(START + 30, 4, "d1")] }).state;
    const profit = (s: typeof base) => s.weeks.reduce((a, w) => a + w.profitCp, 0);
    expect(profit(moved)).toBe(profit(base));
    expect(moved.business.cashCp).toBe(base.business.cashCp - 1000 + 400);
    expect(moved.business.account.withdrawnCp).toBe(1000);
    expect(moved.business.account.depositedCp).toBe(400);
    const entries = moved.business.account.statement.filter((e) => (e.kind === "withdrawal" || e.kind === "deposit") && e.authority === "dm");
    expect(entries.map((e) => [e.kind, e.amountCp, e.authority])).toEqual([
      ["withdrawal", -1000, "dm"],
      ["deposit", 400, "dm"],
    ]);
    expect(moved.history.filter((h) => h.cause.kind === "intervention").every((h) => h.authority === "dm")).toBe(true);
  });

  it("reconciles: start + income − costs − payouts − withdrawals + deposits = balance", () => {
    const s = simulateScenario(world, { plan: planOf("commons-compliant"), seed: "recon", weeks: 12, startDay: START, interventions: [withdraw(START + 15, 5, "w"), deposit(START + 50, 3, "d")] }).state;
    let cash = s.plan.startingCapitalCp;
    for (const w of s.weeks) cash += ledgerIncome(w.ledger) - ledgerCosts(w.ledger) - w.ownerDrawCp - w.withdrawnCp + w.depositedCp;
    expect(Math.abs(cash - s.business.cashCp)).toBeLessThan(2);
  });

  it("'DM-only' payouts never pay the party automatically", () => {
    const s = simulateScenario(world, { plan, seed: "dmonly", weeks: 12, startDay: START }).state;
    expect(s.business.ownerDrawsCp).toBe(0);
    expect(s.business.account.statement.some((e) => e.kind === "payout")).toBe(false);
  });

  it("shows the operating floor and what is safe to withdraw", () => {
    const s = simulateScenario(world, { plan, seed: "floor", weeks: 6, startDay: START }).state;
    const a = accountSummary(world, s);
    expect(a.floorCp).toBeGreaterThan(0);
    expect(a.safeToWithdrawCp).toBe(Math.max(0, a.balanceCp - a.floorCp));
    expect(a.location).toMatch(/strongbox/i);
  });

  it("running dry has consequences, and a deposit is the remedy", () => {
    // Empty the account in week 2 with nobody topping it up.
    const drained = simulateScenario(world, { plan, seed: "dry", weeks: 6, startDay: START, sandbox: { partyTopUps: "never" }, interventions: [withdraw(START + 8, 80, "drain")] }).state;
    const cutOffDays = drained.events.filter((e) => e.eventId === "supplier-cutoff");
    expect(drained.events.some((e) => e.eventId === "bills-overdue")).toBe(true);
    expect(cutOffDays.length).toBeGreaterThan(0);
    const lastWeek = drained.weeks[drained.weeks.length - 1]!;
    expect(lastWeek.produced).toBe(0); // suppliers stopped delivering
    // The same, but the DM records a deposit a week later: production resumes.
    const rescued = simulateScenario(world, {
      plan,
      seed: "dry",
      weeks: 6,
      startDay: START,
      sandbox: { partyTopUps: "never" },
      interventions: [withdraw(START + 8, 80, "drain"), deposit(START + 22, 60, "rescue")],
    }).state;
    expect(rescued.weeks[rescued.weeks.length - 1]!.produced).toBeGreaterThan(0);
  });

  it("the sandbox top-up assumption covers debts once suppliers cut the business off", () => {
    const s = simulateScenario(world, { plan, seed: "dry", weeks: 6, startDay: START, interventions: [withdraw(START + 8, 80, "drain")] }).state;
    const topUps = s.business.account.statement.filter((e) => e.kind === "deposit" && e.authority === "sandbox-assumption");
    expect(topUps.length).toBeGreaterThan(0);
  });

  it("an entry recorded for 'first thing tomorrow' shows immediately and is applied exactly once", () => {
    const until = START + 13; // two full weeks simulated
    const ivs = [withdraw(START + 14, 7, "tomorrow")];
    const now = simulateScenario(world, { plan, seed: "once", weeks: 2, days: 14, startDay: START, interventions: ivs }).state;
    expect(now.business.account.withdrawnCp).toBe(700); // already visible
    // Continue the same state: must not withdraw twice.
    const later = runSimulation(world, now, { untilDay: until + 7, interventions: ivs }).state;
    expect(later.business.account.withdrawnCp).toBe(700);
    // Equals a straight run with the same scheduled entry.
    const straight = simulateScenario(world, { plan, seed: "once", weeks: 3, startDay: START, interventions: ivs }).state;
    expect(JSON.stringify(later)).toBe(JSON.stringify(straight));
  });

  it("players can read the account and statement", () => {
    const r = simulateScenario(world, { plan, seed: "pv", weeks: 4, startDay: START, interventions: [withdraw(START + 10, 5, "w")] });
    const v = buildPlayerView(world, r);
    expect(v.account.statement.some((e) => e.kind === "withdrawal" && e.by === "DM")).toBe(true);
    expect(v.account.balanceCp).toBe(r.state.business.cashCp);
  });
});

describe("only the DM can record withdrawals (server-enforced)", () => {
  const original = process.env.ARENTORIA_DM_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.ARENTORIA_DM_TOKEN;
    else process.env.ARENTORIA_DM_TOKEN = original;
  });

  const body = { plan: planOf("commons-compliant"), seed: "api", days: 14, accountActions: [{ dayOffset: 7, action: "withdraw", amountCp: 500, note: "x" }] };

  it("rejects account actions without DM access", async () => {
    process.env.ARENTORIA_DM_TOKEN = "secret";
    const { POST } = await import("../src/app/api/simulate/route");
    const res = await POST(new Request("http://local/api/simulate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    expect(res.status).toBe(403);
  });

  it("accepts them from the DM", async () => {
    process.env.ARENTORIA_DM_TOKEN = "secret";
    const { POST } = await import("../src/app/api/simulate/route");
    const res = await POST(new Request("http://local/api/simulate", { method: "POST", headers: { "content-type": "application/json", "x-dm-token": "secret" }, body: JSON.stringify(body) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.view.account.withdrawnCp).toBe(500);
  });
});
