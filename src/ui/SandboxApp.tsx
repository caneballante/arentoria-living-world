"use client";
/**
 * The Phase 1 sandbox: edit a plan, run a season, read the results, change the plan,
 * run again. Pauses are handled by deterministic replay: the client keeps only the
 * plan, the seed and the decisions made so far; the server re-simulates from the
 * start each time, so hidden state never has to live in the browser.
 */
import { useCallback, useEffect, useState } from "react";
import { PlanEditor } from "./PlanEditor";
import { ResultsView, summarizeView, type RunSummary } from "./ResultsView";
import type { BusinessPlanInput, Catalog, DmView, PauseMode, PlayerView, ViewMode } from "./types";

const STORAGE_KEY = "arentoria.sandbox.v1";

interface Saved {
  plan: BusinessPlanInput;
  seed: string;
  weeks: number;
}

function load(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(s: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: fine */
  }
}

interface ApiResponse {
  role: ViewMode;
  warnings: string[];
  view: DmView | PlayerView;
}

export function SandboxApp({ catalog }: { catalog: Catalog }) {
  const [plan, setPlan] = useState<BusinessPlanInput>(catalog.scenarios[0]!.plan);
  const [preset, setPreset] = useState<string>(catalog.scenarios[0]!.id);
  const [seed, setSeed] = useState("autumn-940");
  const [weeks, setWeeks] = useState(26);
  const [pause, setPause] = useState<PauseMode>("decisions");
  const [mode, setMode] = useState<ViewMode>("dm");
  const [licensing, setLicensing] = useState<"approve" | "delay" | "deny">("approve");
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [previous, setPrevious] = useState<RunSummary | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = load();
    if (s) {
      setPlan(s.plan);
      setSeed(s.seed);
      setWeeks(s.weeks);
      setPreset("");
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) save({ plan, seed, weeks });
  }, [plan, seed, weeks, hydrated]);

  const call = useCallback(
    async (opts: { resolutions: Record<string, string>; acknowledged: string[]; view: ViewMode; fresh: boolean }) => {
      setBusy(true);
      setIssues([]);
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, seed, weeks, pause, resolutions: opts.resolutions, acknowledged: opts.acknowledged, view: opts.view, sandbox: { licensingOutcome: licensing } }),
        });
        const json = await res.json();
        if (!res.ok) {
          setIssues(json.issues ?? [{ path: "", message: json.error ?? "Request failed" }]);
          return;
        }
        if (opts.fresh && resp && resp.view.status === "completed") setPrevious(summarizeView(resp.view, "previous"));
        setResp(json as ApiResponse);
        setResolutions(opts.resolutions);
        setAcknowledged(opts.acknowledged);
      } catch (e) {
        setIssues([{ path: "", message: e instanceof Error ? e.message : String(e) }]);
      } finally {
        setBusy(false);
      }
    },
    [plan, seed, weeks, pause, licensing, resp],
  );

  const runFresh = () => call({ resolutions: {}, acknowledged: [], view: mode, fresh: true });
  const onResolve = (id: string, option: string) => call({ resolutions: { ...resolutions, [id]: option }, acknowledged, view: mode, fresh: false });
  const onAcknowledge = (eventId: string) => call({ resolutions, acknowledged: [...acknowledged, eventId], view: mode, fresh: false });
  const switchMode = (m: ViewMode) => {
    setMode(m);
    if (resp) call({ resolutions, acknowledged, view: m, fresh: false });
  };

  const choosePreset = (id: string) => {
    setPreset(id);
    const s = catalog.scenarios.find((x) => x.id === id);
    if (s) setPlan(structuredClone(s.plan));
  };

  const downloadPlan = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${plan.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "plan"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const scenario = catalog.scenarios.find((s) => s.id === preset);

  return (
    <div className="sandbox">
      <aside className="panel editor" aria-label="Business plan">
        <div className="panel-pad stack" style={{ gap: 10, borderBottom: "1px solid var(--border)" }}>
          <div className="row"><h2>Business plan</h2><span className="spacer" /><button type="button" className="btn btn-small btn-ghost" onClick={downloadPlan} title="Use with: npm run sim -- --plan file.json">Export JSON</button></div>
          <label className="field">
            <span>Start from a scenario</span>
            <select value={preset} onChange={(e) => choosePreset(e.target.value)}>
              <option value="">— custom plan —</option>
              {catalog.scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.label}{s.quality === "poor" ? " (control)" : ""}</option>
              ))}
            </select>
            {scenario && <span className="hint">{scenario.summary}</span>}
          </label>
        </div>
        <PlanEditor catalog={catalog} plan={plan} onChange={(p) => { setPlan(p); setPreset(""); }} />
      </aside>

      <section className="stack" aria-label="Simulation">
        <div className="panel runbar">
          <label className="field">
            <span>Seed</span>
            <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </label>
          <label className="field" style={{ minWidth: 110 }}>
            <span>Length</span>
            <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              <option value={13}>13 weeks</option>
              <option value={26}>26 weeks (a season)</option>
              <option value={52}>52 weeks</option>
            </select>
          </label>
          <label className="field" style={{ minWidth: 200 }}>
            <span>When something happens</span>
            <select value={pause} onChange={(e) => setPause(e.target.value as PauseMode)}>
              <option value="never">Run straight through (standing orders)</option>
              <option value="decisions">Pause for decisions</option>
              <option value="decisions-and-major">Pause for decisions & major events</option>
            </select>
          </label>
          <label className="field" style={{ minWidth: 150 }}>
            <span>Licensing ruling (DM)</span>
            <select value={licensing} onChange={(e) => setLicensing(e.target.value as typeof licensing)}>
              <option value="approve">Approve (canon expects)</option>
              <option value="delay">Delay 4 weeks</option>
              <option value="deny">Deny</option>
            </select>
          </label>
          <div className="field">
            <span>View as</span>
            <div className="seg" role="group" aria-label="View as">
              <button type="button" aria-pressed={mode === "dm"} onClick={() => switchMode("dm")}>DM</button>
              <button type="button" aria-pressed={mode === "player"} onClick={() => switchMode("player")}>Players</button>
            </div>
          </div>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={runFresh} disabled={busy}>{busy ? "Simulating…" : resp ? "Run again" : "Run the season"}</button>
        </div>
        <p className="small muted" style={{ marginTop: -8 }}>
          Starts {catalog.startDate} (placeholder date in the {catalog.calendarLabel}). Same seed + same plan = same result. Change one thing and run again to see what it does.
        </p>

        {issues.length > 0 && (
          <div className="issues" role="alert">
            <strong>The plan needs fixing:</strong>
            <ul>{issues.map((i, k) => <li key={k}>{i.path ? `${i.path}: ` : ""}{i.message}</li>)}</ul>
          </div>
        )}
        {resp && resp.warnings.length > 0 && (
          <div className="warnings">
            <strong>Heads up:</strong>
            <ul>{resp.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul>
          </div>
        )}
        {resp && mode !== resp.role && <p className="warnings">The server returned the {resp.role} view (DM access is restricted on this deployment).</p>}

        {resp ? (
          <div style={{ opacity: busy ? 0.6 : 1, transition: "opacity 120ms" }}>
            <ResultsView view={resp.view} previous={previous} onResolve={onResolve} onAcknowledge={onAcknowledge} busy={busy} />
          </div>
        ) : (
          <div className="panel empty">
            <p style={{ fontSize: 15, color: "var(--ink)" }}>Configure the pie business on the left, then run a season.</p>
            <p className="small" style={{ marginTop: 6 }}>The DM view shows hidden reputation, attention and the causes of every change. The players' view shows only what the party would actually learn.</p>
          </div>
        )}
      </section>
    </div>
  );
}
