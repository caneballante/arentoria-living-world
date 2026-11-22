/**
 * Narrative layer: turns simulated weeks into readable reports.
 *
 * Rules:
 *  - Text only describes conditions that actually exist in the simulation.
 *  - Every line carries a DM-only `basis` explaining which real condition produced it.
 *  - Players never see hidden numbers; they get qualitative signals, filtered through
 *    staff observation (loyal staff tell you more) and street talk.
 *  - Deterministic: wording varies by seed/week, never by wall-clock time.
 */
import { dateFromDay, formatShortDate } from "../engine/calendar";
import { formatCp, round } from "../engine/math";
import { rngFor, type Rng } from "../engine/rng";
import type { Driver, EventRecord, HiddenVar, WeekRecord, WorldDefinition, WorldState } from "../engine/types";

export type ReportSection = "summary" | "operations" | "customers" | "staff" | "street" | "events" | "weather";

export interface ReportLine {
  section: ReportSection;
  tone: "good" | "bad" | "neutral";
  text: string;
  /** DM-only explanation of the underlying condition. Stripped from player views. */
  basis: string;
}

export interface WeeklyReport {
  week: number;
  title: string;
  dateRange: string;
  lines: ReportLine[];
}

const HIDDEN_LABELS: Record<HiddenVar, string> = {
  reputation: "Reputation",
  loyalty: "Customer loyalty",
  visibility: "Visibility",
  scrutiny: "Official scrutiny",
  guildRelation: "Guild relationship",
  criminalAttention: "Criminal attention",
  rivalHostility: "Rival hostility",
  constructStrain: "Construct strain",
};

export const hiddenLabel = (v: HiddenVar) => HIDDEN_LABELS[v];

function topDriver(drivers: Driver[] | undefined, sign: 1 | -1, exclude: string[] = []): Driver | undefined {
  return (drivers ?? []).filter((d) => !exclude.includes(d.label) && Math.sign(d.value) === sign).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
}

const fmtDelta = (from: number, to: number) => `${round(from, 1)} → ${round(to, 1)}`;

function weekDateRange(world: WorldDefinition, w: WeekRecord): string {
  return `${formatShortDate(dateFromDay(world.calendar, w.startDay))} – ${formatShortDate(dateFromDay(world.calendar, w.endDay))}`;
}

function observes(rng: Rng, loyalty: number): boolean {
  // Loyal staff are more forthcoming with what they notice.
  return rng.next() < 0.45 + loyalty / 200;
}

export function buildWeeklyReport(world: WorldDefinition, state: WorldState, w: WeekRecord): WeeklyReport {
  const plan = state.plan;
  const n = world.neighborhoods[plan.neighborhood]!;
  const lines: ReportLine[] = [];
  const add = (section: ReportSection, tone: ReportLine["tone"], text: string, basis: string) => lines.push({ section, tone, text, basis });
  const rng = (key: string) => rngFor(state.seed, "narrative", w.index, key);
  const h0 = w.hiddenStart;
  const h1 = w.hiddenEnd;
  const outlet = world.channels[plan.channels[0]?.type ?? "cart"].label.toLowerCase();

  // --- Summary (facts the party can count themselves) ---
  const profitWord = w.profitCp >= 0 ? "profit" : "loss";
  add(
    "summary",
    w.profitCp >= 0 ? "good" : "bad",
    `Sold ${w.sold} of ${w.produced} pies over ${w.operatingDays} trading day(s). Takings ${formatCp(w.revenueCp)}, costs ${formatCp(w.costsCp)} — a ${profitWord} of ${formatCp(Math.abs(w.profitCp))}.${w.ownerDrawCp > 0 ? ` Paid the party ${formatCp(w.ownerDrawCp)}.` : ""} Cash on hand: ${formatCp(w.cashEndCp)}.`,
    `Ledger. Skimmed (hidden from players): ${formatCp(w.skimmedCp)}.`,
  );

  // --- Operations ---
  const wasteShare = w.produced > 0 ? w.waste / w.produced : 0;
  if (wasteShare >= 0.25) {
    add("operations", "bad", `We threw out ${w.waste} unsold pies — ${Math.round(wasteShare * 100)}% of the batch.`, `Production exceeded demand. Visibility ${round(h0.visibility, 0)} limits awareness; price and quality fit also matter.`);
  } else if (wasteShare >= 0.1) {
    add("operations", "neutral", `${w.waste} pies went unsold.`, `Waste ${Math.round(wasteShare * 100)}%.`);
  }
  if (w.stockoutDays >= 2) {
    add("operations", "neutral", `Sold out early on ${w.stockoutDays} day(s); customers were turned away.`, "Demand exceeded stock or selling capacity on those days. More production or staff would capture it.");
  }
  if (w.operatingDays === 0) add("operations", "bad", "We did not trade this week.", "Business suspended or closed.");

  // --- Customers (from real reputation/loyalty dynamics) ---
  const repDelta = h1.reputation - h0.reputation;
  const repDrivers = w.drivers.reputation;
  if (repDelta <= -1.5) {
    const d = topDriver(repDrivers, -1, ["Drift toward neutral"]);
    const text =
      d?.label === "Value for money"
        ? "Several passers-by looked at the price board and walked on."
        : d?.label === "Quality vs. local expectations"
          ? plan.quality < n.demand.qualityPreference
            ? "A customer said the filling tasted 'like the bottom of the barrel'."
            : "A customer remarked that the pies were plain for the money."
          : d?.label === "Service (staff competence)"
            ? "Someone complained their pie was cold and the service slow."
            : d?.label === "Sold out / unreliable"
              ? "Regulars grumble that we're always sold out by the evening rush."
              : "Fewer familiar faces than last week.";
    add("customers", "bad", text, `Reputation ${fmtDelta(h0.reputation, h1.reputation)}; largest negative driver: ${d ? `${d.label} (${round(d.value, 2)})` : "events"}.`);
  } else if (repDelta >= 1.5) {
    const d = topDriver(repDrivers, 1, ["Drift toward neutral"]);
    const text =
      d?.label === "Value for money"
        ? "Word is that our pies are a bargain for what you get."
        : d?.label === "Quality vs. local expectations"
          ? "A customer came back just to say it was the best pie they'd had this year."
          : d?.label === "Service (staff competence)"
            ? "Customers like the quick, friendly service."
            : "Familiar faces are coming back and bringing friends.";
    add("customers", "good", text, `Reputation ${fmtDelta(h0.reputation, h1.reputation)}; largest positive driver: ${d ? `${d.label} (${round(d.value, 2)})` : "events"}.`);
  }
  if (h1.reputation >= 65 && w.index % 3 === 0) add("customers", "good", `People around ${n.name} recommend us by name.`, `Reputation ${round(h1.reputation, 0)} (high).`);
  if (h1.reputation <= 30 && w.index % 2 === 0) add("customers", "bad", "Some people cross the street rather than pass our pitch.", `Reputation ${round(h1.reputation, 0)} (low).`);
  if (h1.loyalty >= 30 && h0.loyalty < 30) add("customers", "good", "A handful of regulars now come by every day.", `Loyalty crossed 30 (${round(h1.loyalty, 0)}).`);
  if (h1.visibility >= 60 && h0.visibility < 60) add("street", "good", `People across ${n.name} seem to know our name now.`, `Visibility ${fmtDelta(h0.visibility, h1.visibility)}.`);
  if (w.index >= 3 && h1.visibility < 15) add("street", "bad", "Few people seem to know we exist.", `Visibility ${round(h1.visibility, 0)}: advertising and outlet presence are low.`);

  // --- Weather and calendar ---
  const wet = (w.weather.conditions.rain ?? 0) + (w.weather.conditions.storm ?? 0) + (w.weather.conditions.snow ?? 0);
  if ((w.weather.conditions.snow ?? 0) >= 2) add("weather", "neutral", `Snow on ${w.weather.conditions.snow} day(s); the streets were quiet but cold customers wanted hot food.`, `Snow cuts foot traffic (×${world.climate.footTraffic.snow}) but cold raises pie appeal. Avg ${w.weather.avgTempC}°C.`);
  else if (wet >= 3) add("weather", "bad", `A wet week — ${wet} day(s) of rain or storms. Foot traffic was thin.`, `Weather exposure by channel. Storm days ×${world.climate.footTraffic.storm} traffic.`);
  else if (wet === 0) add("weather", "good", "Dry weather all week; the streets were busy.", "No wet days.");
  if (w.weather.avgTempC < 6) add("weather", "good", "Cold enough that hot pies practically sold themselves.", `Avg ${w.weather.avgTempC}°C boosts hot-food appeal.`);
  for (const f of w.festivals) add("weather", "good", `${f} brought crowds into the streets.`, "Festival demand multiplier (proposed calendar).");

  // --- The business account ---
  if (w.accountStatus === "thin") {
    add("summary", "bad", "Money in the business is getting thin — less than a week's running costs.", `Balance ${formatCp(w.cashEndCp)} vs operating floor ${formatCp(w.accountFloorCp)}.`);
  } else if (w.accountStatus === "healthy" && w.cashEndCp >= w.accountFloorCp * 1.5 && w.index % 4 === 0) {
    add("summary", "good", `The business could spare about ${formatCp(w.cashEndCp - w.accountFloorCp)} for the party without running short.`, `Safe to withdraw = balance ${formatCp(w.cashEndCp)} − floor ${formatCp(w.accountFloorCp)}.`);
  }
  if (w.withdrawnCp > 0) add("summary", "neutral", `The party withdrew ${formatCp(w.withdrawnCp)} from the business this week.`, "DM-recorded withdrawal(s).");
  if (w.depositedCp > 0) add("summary", "neutral", `The party put ${formatCp(w.depositedCp)} into the business this week.`, "DM-recorded deposit(s).");

  // --- The constructs (the party can see their own chefs straining) ---
  if (h1.constructStrain >= 30) add("operations", "bad", "The constructs are running hot: one judders between batches and the kitchen smells of scorched brass.", `Construct strain ${round(h1.constructStrain, 0)} — serious breakdowns (even a fire) are now possible.`);
  else if (h1.constructStrain >= 18 && h0.constructStrain < 18) add("operations", "neutral", "The constructs are working flat out; the kitchen never really stops now.", `Construct strain ${round(h1.constructStrain, 0)}.`);

  // --- Staff observations ---
  for (const s of w.staff) {
    const r = rng(`staff-${s.id}`);
    if (!observes(r, s.loyalty)) continue;
    const market = world.assumptions.marketWageCpPerDay[s.role];
    const wage = state.plan.staff.find((x) => x.candidateId === s.id)?.wageCpPerDay ?? market;
    if (s.morale < 35) add("staff", "bad", `${s.name} seems tired and short-tempered.`, `Morale ${round(s.morale, 0)}; wage ${wage} cp vs market ${market} cp.`);
    else if (wage < market * 0.85 && r.next() < 0.5) add("staff", "neutral", `${s.name} mentioned that sellers elsewhere earn more.`, `Wage ${wage} cp/day vs market ${market} cp/day.`);
    else if (s.morale > 75 && r.next() < 0.4) add("staff", "good", `${s.name} is in good spirits and chatting up customers.`, `Morale ${round(s.morale, 0)}.`);
  }
  const weeklySkim = w.skimmedCp;
  if (weeklySkim > 0 && plan.oversight !== "hands-off" && weeklySkim > w.revenueCp * 0.04 && rng("skim").next() < (plan.oversight === "frequent" ? 0.6 : 0.3)) {
    add("staff", "bad", "The count came up a little light again.", `Skimming this week: ${formatCp(weeklySkim)}.`);
  }

  // --- Street talk: early warnings of developing threads ---
  const loyalStaff = w.staff.reduce((a, s) => Math.max(a, s.loyalty), 0);
  const thread = (id: string) => w.threads.find((t) => t.id === id);
  const teller = w.staff.slice().sort((a, b) => b.loyalty - a.loyalty)[0]?.name ?? "One of our sellers";
  const ext = thread("extortion");
  if (ext && ext.stage === 0 && h1.criminalAttention >= 35 && observes(rng("crim"), loyalStaff)) {
    add("street", "bad", `${teller} thinks the same faces have been loitering near the ${outlet}.`, `Criminal attention ${round(h1.criminalAttention, 0)} (extortion pressure ${ext.pressure}/wk).`);
  }
  const insp = thread("inspection");
  if (insp && insp.stage === 0 && h1.scrutiny >= 22 && observes(rng("scr"), loyalStaff)) {
    add("street", "bad", "Talk among the stallholders: the licensing office is checking permits this month.", `Scrutiny ${round(h1.scrutiny, 0)}.`);
  }
  const guild = thread("guild-pressure");
  if (guild && guild.stage === 0 && guild.progress >= 2 && plan.guild === "none" && observes(rng("guild"), loyalStaff)) {
    add("street", "neutral", "Other sellers keep asking whether we've 'squared things with the Fellowship'.", `Guild pressure progress ${guild.progress}; guild relation ${round(h1.guildRelation, 0)}.`);
  }
  const rival = thread("rival-response");
  if (rival && rival.stage === 0 && h1.rivalHostility >= 30 && observes(rng("rival"), loyalStaff)) {
    const name = world.actors.find((a) => a.id === n.rivalActorId)?.name ?? "A rival";
    add("street", "bad", `${name} have started calling out 'real pies, honest meat' whenever customers drift our way.`, `Rival hostility ${round(h1.rivalHostility, 0)}.`);
  }

  // --- Events players witnessed ---
  const events = state.events.filter((e) => e.week === w.index && e.visibleToPlayers && e.eventId !== "staff-absence");
  for (const e of events) {
    const tone: ReportLine["tone"] = e.category === "opportunity" ? "good" : e.severity === "minor" ? "neutral" : "bad";
    const byPlayers = e.resolution && (e.resolution.authority === "players" || e.resolution.authority === "standing-order");
    const resolution = e.resolution ? (byPlayers ? ` We decided: ${e.resolution.label}.` : ` Outcome: ${e.resolution.label}.`) : "";
    add("events", tone, `${e.playerText}${resolution}`, `${e.title}${e.probability !== undefined ? ` (p=${e.probability})` : ""}. ${e.dmText}`);
  }
  const absences = state.events.filter((e) => e.week === w.index && e.eventId === "staff-absence");
  if (absences.length) add("staff", "neutral", absences.length === 1 ? absences[0]!.playerText : `Staff absences on ${absences.length} days.`, absences.map((a) => a.dmText).join(" "));

  return { week: w.index, title: `Week ${w.index}`, dateRange: weekDateRange(world, w), lines };
}

export function buildAllReports(world: WorldDefinition, state: WorldState): WeeklyReport[] {
  return state.weeks.map((w) => buildWeeklyReport(world, state, w));
}

/** DM explanation: what moved each hidden variable this week, largest drivers first. */
export function explainWeek(w: WeekRecord): { variable: HiddenVar; label: string; from: number; to: number; drivers: Driver[] }[] {
  return (Object.keys(HIDDEN_LABELS) as HiddenVar[]).map((v) => {
    const drivers = [...(w.drivers[v] ?? [])];
    // Anything the weekly dynamics don't account for came from events, decisions or the 0–100 limits.
    const residual = w.hiddenEnd[v] - w.hiddenStart[v] - drivers.reduce((a, d) => a + d.value, 0);
    if (Math.abs(residual) >= 0.05) drivers.push({ label: "Events, decisions & limits this week", value: round(residual, 3) });
    return {
      variable: v,
      label: HIDDEN_LABELS[v],
      from: round(w.hiddenStart[v], 1),
      to: round(w.hiddenEnd[v], 1),
      drivers: drivers.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    };
  });
}

export function describeEventForDm(e: EventRecord): string {
  const p = e.probability !== undefined ? ` p=${e.probability}` : "";
  return `[${e.severity}] ${e.title}${p}: ${e.dmText}`;
}
