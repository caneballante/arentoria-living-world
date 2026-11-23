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
    const drained = simulateScenario(world, { plan, seed: "dry", weeks: 6, startDay: START, sandbox: { partyTopUps: "never" }, interventions: [withdraw(START + 8, 200, "drain")] }).state;
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
      interventions: [withdraw(START + 8, 200, "drain"), deposit(START + 22, 150, "rescue")],
    }).state;
    expect(rescued.weeks[rescued.weeks.length - 1]!.produced).toBeGreaterThan(0);
  });

  it("the sandbox top-up assumption covers debts once suppliers cut the business off", () => {
    const s = simulateScenario(world, { plan, seed: "dry", weeks: 6, startDay: START, interventions: [withdraw(START + 8, 200, "drain")] }).state;
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

describe("running out of money: the players are told what it costs and what they need", () => {
  const plan = planOf("commons-compliant", { finance: { reserveTargetCp: 2500, ownerDrawShare: 0, payoutMode: "dm-only", reinvestAdvertisingShare: 0.1 } });
  const drained = simulateScenario(world, { plan, seed: "dry", weeks: 6, startDay: START, sandbox: { partyTopUps: "never" }, interventions: [withdraw(START + 8, 200, "drain")] }).state;

  it("records the suppliers' credit surcharge and late wages, and says so in the report", async () => {
    const { buildAllReports } = await import("../src/narrative/weekly-report");
    // Overdraw by about 15 gp: within the suppliers' credit, so they keep delivering, at a price.
    const before = simulateScenario(world, { plan, seed: "short", weeks: 2, days: 10, startDay: START, sandbox: { partyTopUps: "never" } }).state;
    const gp = Math.ceil(before.business.cashCp / 100) + 15;
    const short = simulateScenario(world, { plan, seed: "short", weeks: 3, startDay: START, sandbox: { partyTopUps: "never" }, interventions: [withdraw(START + 10, gp, "short")] }).state;
    const owing = short.weeks.filter((w) => (w.creditSurchargeCp ?? 0) > 0);
    expect(owing.length).toBeGreaterThan(0);
    expect(short.weeks.some((w) => w.wagesLate)).toBe(true);
    const reports = buildAllReports(world, short);
    const lines = reports.flatMap((r) => r.lines.filter((l) => l.brief).map((l) => l.text));
    // Either the overdue-bills notice or the "running short" line spells it out, in the short report.
    const said = lines.filter((t) => /charge 10% extra on everything we buy|suppliers charged us .+ extra for buying on credit \(10% while we owe them\)/.test(t));
    expect(said.length).toBeGreaterThan(0);
    expect(lines.some((t) => /wages (go|went) out late/.test(t))).toBe(true);
  });

  it("tells the players how much clears the debt and how much gets deliveries going again", () => {
    const bills = drained.events.find((e) => e.eventId === "bills-overdue")!;
    expect(bills.playerText).toMatch(/we owe our suppliers about .+ gp/);
    expect(bills.playerText).toMatch(/clears the debt; .+ would also leave a week's cushion/);
    const cutoff = drained.events.find((e) => e.eventId === "supplier-cutoff")!;
    expect(cutoff.playerText).toMatch(/At least .+ gp in the strongbox gets deliveries going again/);
    expect(cutoff.sessionHook).not.toMatch(/lend/);
  });

  it("depositing the amount it names really does get deliveries going again", () => {
    // Find the first day suppliers stopped, take the account as it stood, and deposit exactly what it says.
    const cut = drained.events.find((e) => e.eventId === "supplier-cutoff")!;
    const upTo = simulateScenario(world, { plan, seed: "dry", weeks: 6, days: cut.day - START + 1, startDay: START, sandbox: { partyTopUps: "never" }, interventions: [withdraw(START + 8, 200, "drain")] }).state;
    const need = accountSummary(world, upTo);
    expect(need.toResumeCp).toBeGreaterThan(0);
    expect(need.toResumeCp % 100).toBe(0); // whole gold
    expect(need.toClearCp).toBeGreaterThanOrEqual(need.toResumeCp);
    expect(need.toCushionCp).toBeGreaterThan(need.toClearCp);
    const after = runSimulation(world, upTo, { untilDay: upTo.day + 6, interventions: [deposit(upTo.day, need.toResumeCp / 100, "rescue")] }).state;
    const days = [...after.weeks.filter((w) => w.endDay >= upTo.day).flatMap(() => []), ...after.current.days];
    const resumed = after.weeks.some((w) => w.endDay >= upTo.day && w.produced > 0) || days.some((d) => d.produced > 0);
    expect(resumed).toBe(true);
  });
});
