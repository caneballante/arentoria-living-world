/**
 * Compare strategies over repeated seeded runs.
 *
 *   npm run compare -- --runs 40 --weeks 26
 *   npm run compare -- --runs 40 --weeks 52 --scenarios commons-compliant,low-price-volume
 *   npm run compare -- --json > comparison.json
 */
import { pairedWinRate, runBatch } from "../src/analysis/batch";
import { formatCp } from "../src/engine/math";
import { arentoria, DEFAULT_START_DAY, scenarios } from "../src/world";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("--")) return process.argv[i + 1];
  return process.argv.includes(`--${name}`) ? "true" : fallback;
}

const runs = Number(arg("runs", "30"));
const weeksList = (arg("weeks", "26,52") ?? "26").split(",").map(Number);
const ids = arg("scenarios")?.split(",");
const chosen = ids ? scenarios.filter((s) => ids.includes(s.id)) : scenarios;
const t0 = Date.now();
const json: unknown[] = [];

for (const weeks of weeksList) {
  const batch = runBatch(arentoria, chosen, { runs, weeks, startDay: DEFAULT_START_DAY, seedPrefix: arg("seed", "cmp") });
  if (arg("json")) {
    json.push(batch.summaries);
    continue;
  }
  console.log(`\n=== ${weeks} weeks × ${runs} seeded runs per scenario (SANDBOX, provisional assumptions) ===\n`);
  console.log(
    "Scenario".padEnd(36) +
      "Profit p10 / median / p90".padStart(30) +
      "  P(loss)  P(cash<0)  LossWks  EndRep  Adverse   Extort3+  Guild3+  Rival3+  Inspect",
  );
  for (const s of batch.summaries) {
    const p = s.totalProfitCp;
    const r = s.threadReach;
    console.log(
      s.label.padEnd(36) +
        `${formatCp(p.p10)} / ${formatCp(p.p50)} / ${formatCp(p.p90)}`.padStart(30) +
        `${(s.pNetLoss * 100).toFixed(0)}%`.padStart(9) +
        `${(s.pCashNegative * 100).toFixed(0)}%`.padStart(11) +
        s.lossWeeks.mean.toFixed(1).padStart(9) +
        s.endReputation.mean.toFixed(0).padStart(8) +
        s.adverseEvents.mean.toFixed(1).padStart(9) +
        `${((r.extortion?.[3] ?? 0) * 100).toFixed(0)}%`.padStart(11) +
        `${((r["guild-pressure"]?.[3] ?? 0) * 100).toFixed(0)}%`.padStart(9) +
        `${((r["rival-response"]?.[3] ?? 0) * 100).toFixed(0)}%`.padStart(9) +
        `${((r.inspection?.[2] ?? 0) * 100).toFixed(0)}%`.padStart(9),
    );
  }
  console.log("\nEnd states:");
  for (const s of batch.summaries) {
    const parts = Object.entries(s.endStates).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`);
    console.log(`  ${s.label.padEnd(36)} ${parts.join(", ")}`);
  }
  const sound = chosen.filter((s) => s.quality === "sound");
  const poor = chosen.filter((s) => s.quality === "poor");
  if (sound.length && poor.length) {
    console.log("\nPaired comparisons (same seeds — same weather and dice):");
    for (const a of sound) for (const b of poor) {
      console.log(`  ${a.label} beats ${b.label} in ${(pairedWinRate(batch.runs[a.id]!, batch.runs[b.id]!) * 100).toFixed(0)}% of seeds`);
    }
  }
}
if (arg("json")) process.stdout.write(JSON.stringify(json, null, 2));
else console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
