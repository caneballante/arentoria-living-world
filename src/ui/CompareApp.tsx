"use client";
import { useEffect, useState } from "react";
import { RangeChart } from "./Charts";
import { formatCp, pct } from "./format";
import type { BusinessPlanInput, Catalog, ScenarioSummary } from "./types";

interface CompareResponse {
  options: { runs: number; weeks: number };
  summaries: ScenarioSummary[];
  paired: { a: string; b: string; winRate: number }[];
}

const THREADS: { id: string; label: string; stage: number }[] = [
  { id: "extortion", label: "Extortion reached a demand", stage: 2 },
  { id: "extortion", label: "…and violence", stage: 3 },
  { id: "guild-pressure", label: "Guild formal notice", stage: 2 },
  { id: "rival-response", label: "Rival price war", stage: 2 },
  { id: "inspection", label: "Inspection", stage: 2 },
];

export function CompareApp({ catalog }: { catalog: Catalog }) {
  const [selected, setSelected] = useState<string[]>(catalog.scenarios.map((s) => s.id));
  const [includeMine, setIncludeMine] = useState(false);
  const [mine, setMine] = useState<BusinessPlanInput | null>(null);
  const [runs, setRuns] = useState(20);
  const [weeks, setWeeks] = useState(26);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("arentoria.sandbox.v1");
      if (raw) {
        setMine(JSON.parse(raw).plan as BusinessPlanInput);
        setIncludeMine(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioIds: selected, runs, weeks, customPlan: includeMine && mine ? mine : undefined }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.issues?.map((i: { message: string }) => i.message).join("; ") || json.error);
      else setData(json as CompareResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const sorted = data ? [...data.summaries].sort((a, b) => b.totalProfitCp.p50 - a.totalProfitCp.p50) : [];
  const custom = data?.summaries.find((s) => s.scenarioId === "custom");

  return (
    <div className="stack">
      <div className="panel panel-pad stack">
        <div>
          <h2>Compare strategies</h2>
          <p className="secondary" style={{ marginTop: 4 }}>
            Each strategy runs on the same set of seeds, so run <em>i</em> of every strategy sees the same weather and the same dice. Differences come from the plans, not from luck.
          </p>
        </div>
        <div className="grid-cards" style={{ gap: 6 }}>
          {catalog.scenarios.map((s) => (
            <label key={s.id} className="check" title={s.summary}>
              <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
              {s.label}{s.quality === "poor" ? <span className="muted small">(control)</span> : null}
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={includeMine} disabled={!mine} onChange={(e) => setIncludeMine(e.target.checked)} />
            Your current sandbox plan{mine ? `: ${mine.name}` : " (edit one in the Sandbox first)"}
          </label>
        </div>
        <div className="row">
          <label className="field" style={{ width: 130 }}>
            <span>Runs per strategy</span>
            <select value={runs} onChange={(e) => setRuns(Number(e.target.value))}>
              {[10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="field" style={{ width: 130 }}>
            <span>Length</span>
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              <option value={26}>26 weeks</option>
              <option value={52}>52 weeks</option>
            </select>
          </label>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy || (!selected.length && !includeMine)}>{busy ? "Running…" : "Run comparison"}</button>
        </div>
        {error && <div className="issues">{error}</div>}
      </div>

      {data && (
        <div style={{ opacity: busy ? 0.6 : 1 }} className="stack">
          <div className="panel chart-card">
            <div className="chart-head"><h3>Total profit over {data.options.weeks} weeks</h3><span className="chart-sub">{data.options.runs} seeded runs each · sorted by median</span></div>
            <RangeChart rows={sorted.map((s) => ({ label: s.label, ...s.totalProfitCp }))} format={(v) => formatCp(v)} />
          </div>

          <div className="panel panel-pad">
            <h3 style={{ marginBottom: 8 }}>Outcomes and exposure</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Strategy</th><th>Median profit</th><th>Paid to party</th><th>P(net loss)</th><th>P(overdrawn)</th><th>P(party had to bail out)</th><th>Losing weeks</th><th>End reputation</th><th>Waste</th><th>Adverse events</th>
                    {THREADS.map((t) => <th key={t.label}>{t.label}</th>)}
                    <th className="left">Most common end state</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => {
                    const top = Object.entries(s.endStates).sort((a, b) => b[1] - a[1])[0];
                    return (
                      <tr key={s.scenarioId}>
                        <td>{s.label}</td>
                        <td>{formatCp(s.totalProfitCp.p50)}</td>
                        <td>{formatCp(s.ownerDrawsCp.p50)}</td>
                        <td>{pct(s.pNetLoss)}</td>
                        <td>{pct(s.pCashNegative)}</td>
                        <td>{pct(s.pBailout)}</td>
                        <td>{s.lossWeeks.mean.toFixed(1)}</td>
                        <td>{Math.round(s.endReputation.mean)}</td>
                        <td>{pct(s.wasteRate.mean)}</td>
                        <td>{s.adverseEvents.mean.toFixed(1)}</td>
                        {THREADS.map((t) => <td key={t.label}>{pct(s.threadReach[t.id]?.[t.stage] ?? 0)}</td>)}
                        <td className="left">{top ? `${top[0]} (${pct(top[1])})` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              Thread columns: share of runs in which that situation reached the stage. End states: failing (cash below zero), under-pressure (a thread at stage 3+), thriving (late profit ≥ 15 gp/week and reputation ≥ 55), profitable, struggling.
            </p>
          </div>

          <div className="panel panel-pad">
            <h3 style={{ marginBottom: 4 }}>Pacing — how often something happens</h3>
            <p className="small muted" style={{ marginBottom: 8 }}>
              Averages over {data.options.weeks} in-game weeks. Targets per 52 weeks: a sound business sees about 6–10 decisions, 10–15 notable report items and a few major moments, with no more than ~10 quiet weeks in a row; risky businesses roughly twice as busy, without the same crisis repeating more than three times.
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Strategy</th><th>Player decisions</th><th>DM rulings</th><th>Notable events</th><th>Major events</th><th>Longest quiet stretch</th><th>Most repeats of one crisis</th></tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.scenarioId}>
                      <td>{s.label}</td>
                      <td>{s.playerDecisions.mean.toFixed(1)}</td>
                      <td>{s.dmDecisions.mean.toFixed(1)}</td>
                      <td>{s.notableEvents.mean.toFixed(1)}</td>
                      <td>{s.majorMoments.mean.toFixed(1)}</td>
                      <td>{s.longestQuietWeeks.mean.toFixed(1)} weeks</td>
                      <td>{s.maxStageRepeats.mean.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {custom && (
            <div className="panel panel-pad">
              <h3 style={{ marginBottom: 8 }}>Your plan, head to head</h3>
              <table className="data" style={{ maxWidth: 640 }}>
                <thead><tr><th>Versus</th><th>Your plan earns more in…</th></tr></thead>
                <tbody>
                  {data.paired.filter((p) => p.a === "custom").map((p) => (
                    <tr key={p.b}><td>{data.summaries.find((s) => s.scenarioId === p.b)?.label}</td><td>{pct(p.winRate)} of seeds</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
