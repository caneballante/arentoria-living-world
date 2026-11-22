/**
 * Run one scenario and print a readable season report.
 *
 *   npm run sim -- --scenario commons-compliant --seed autumn-940 --weeks 26 --view dm
 *   npm run sim -- --plan ./my-plan.json --weeks 52 --view player
 *   npm run sim -- --scenario high-march-luxury --json > run.json
 */
import { readFileSync } from "node:fs";
import { dateFromDay, formatShortDate } from "../src/engine/calendar";
import { describeEffect } from "../src/engine/effects";
import { formatCp, round } from "../src/engine/math";
import { simulateScenario } from "../src/engine/simulate";
import { buildAllReports, explainWeek } from "../src/narrative/weekly-report";
import { buildDmView, buildPlayerView } from "../src/views";
import { arentoria, DEFAULT_START_DAY, getScenario, scenarios } from "../src/world";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--")) return process.argv[i + 1];
  return process.argv.includes(`--${name}`) ? "true" : fallback;
}

if (arg("list")) {
  for (const s of scenarios) console.log(`${s.id.padEnd(26)} ${s.label} — ${s.summary}`);
  process.exit(0);
}

const scenarioId = arg("scenario", "commons-compliant")!;
const planFile = arg("plan");
const plan = planFile ? JSON.parse(readFileSync(planFile, "utf8")) : getScenario(scenarioId).plan;
const seed = arg("seed", "autumn-940")!;
const weeks = Number(arg("weeks", "26"));
const view = arg("view", "dm");

const result = simulateScenario(arentoria, { plan, seed, weeks, startDay: DEFAULT_START_DAY });
const s = result.state;

if (arg("json")) {
  const out = view === "player" ? buildPlayerView(arentoria, result) : buildDmView(arentoria, result);
  process.stdout.write(JSON.stringify(out, null, 2));
  process.exit(0);
}

const cal = arentoria.calendar;
const d = (day: number) => formatShortDate(dateFromDay(cal, day));
console.log(`\n${s.plan.name} — ${arentoria.neighborhoods[s.plan.neighborhood]!.name}`);
console.log(`Seed "${seed}", ${weeks} weeks from ${d(s.startDay)} (proposed calendar). SANDBOX — not canon.\n`);

console.log("Wk  Dates                         Sold  Waste   Revenue     Costs    Profit      Cash" + (view === "dm" ? "   Rep  Vis  Crim  Scr  Guild Rival" : ""));
for (const w of s.weeks) {
  const h = w.hiddenEnd;
  const cols = [
    String(w.index).padStart(2),
    `${d(w.startDay)} – ${d(w.endDay)}`.padEnd(29),
    String(w.sold).padStart(5),
    String(w.waste).padStart(6),
    formatCp(w.revenueCp).padStart(9),
    formatCp(w.costsCp).padStart(9),
    formatCp(w.profitCp).padStart(9),
    formatCp(w.cashEndCp).padStart(9),
  ];
  if (view === "dm") cols.push(...[h.reputation, h.visibility, h.criminalAttention, h.scrutiny, h.guildRelation, h.rivalHostility].map((x) => String(Math.round(x)).padStart(5)));
  console.log(cols.join(" "));
}
const total = s.weeks.reduce((a, w) => a + w.profitCp, 0);
console.log(`\nTotal profit ${formatCp(total)} · paid to party ${formatCp(s.business.ownerDrawsCp)} · lowest cash ${formatCp(s.business.minCashCp)} · status ${s.business.status}`);

console.log("\nEvents:");
for (const e of s.events.filter((x) => x.eventId !== "staff-absence")) {
  if (view === "player" && !e.visibleToPlayers) continue;
  const text = view === "player" ? e.playerText : `${e.title}${e.probability !== undefined ? ` (p=${e.probability})` : ""} — ${e.dmText}`;
  console.log(`  ${d(e.day).padEnd(18)} [${e.severity}] ${text}${e.resolution ? `  → ${e.resolution.label} (${e.resolution.authority})` : ""}`);
}

if (view === "dm") {
  console.log("\nThreads (peak stage):");
  for (const t of arentoria.threads) {
    const ts = s.threads[t.id]!;
    console.log(`  ${t.title.padEnd(22)} peak ${ts.peakStage}, now ${ts.stage} (progress ${round(ts.progress, 1)})`);
  }
  const last = s.weeks[s.weeks.length - 1];
  if (last) {
    console.log(`\nWhy things changed in week ${last.index}:`);
    for (const v of explainWeek(last)) {
      const top = v.drivers.slice(0, 3).map((x) => `${x.label} ${x.value >= 0 ? "+" : ""}${round(x.value, 2)}`).join("; ");
      console.log(`  ${v.label.padEnd(20)} ${v.from} → ${v.to}   ${top}`);
    }
    console.log(`  Resilience ${round(last.derived.resilience, 0)}: ${last.derived.resilienceBreakdown.map((x) => `${x.label} ${round(x.value, 1)}`).join(", ")}`);
  }
  console.log("\nAudit trail (decisions & interventions):");
  for (const h of s.history.filter((x) => x.cause.kind === "decision" || x.cause.kind === "intervention")) {
    console.log(`  ${d(h.day).padEnd(18)} ${h.authority.padEnd(18)} ${h.description} :: ${h.effects.map(describeEffect).join("; ")}`);
  }
}

const reports = buildAllReports(arentoria, s);
const show = Number(arg("reports", "3"));
console.log(`\nLast ${show} weekly report(s) as players read them:`);
for (const r of reports.slice(-show)) {
  console.log(`\n  ${r.title} (${r.dateRange})`);
  for (const l of r.lines) console.log(`   • ${l.text}${view === "dm" ? `\n       ↳ ${l.basis}` : ""}`);
}
if (result.status === "paused") console.log("\nPaused with pending decisions:", result.pending.map((p) => p.prompt));
