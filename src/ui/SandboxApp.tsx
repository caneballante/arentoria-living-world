"use client";
/**
 * The Phase 1 sandbox, run like a campaign clock: advance a day, a week, a month, or
 * "until something needs the party"; answer decisions now or before their deadline;
 * revise the plan between sessions and keep going; or run a whole season at once.
 *
 * Everything is deterministic replay: the client keeps only the starting plan, the
 * seed, plan revisions by day, the decisions made so far and how far the clock has
 * run. The server re-simulates from the start each time, so hidden state never has to
 * live in the browser.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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

interface Session {
  basePlan: BusinessPlanInput;
  planChanges: { dayOffset: number; plan: BusinessPlanInput }[];
  /** Days the clock has been asked to reach. */
  target: number;
  resolutions: Record<string, string>;
  acknowledged: string[];
  /** Day offset where the latest advance began (for the "since last time" digest). */
  digestFrom: number;
  /** Day offset after which "until needed" stops (unset for plain advances). */
  stopFrom?: number;
  pause: PauseMode;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function SandboxApp({ catalog }: { catalog: Catalog }) {
  const [plan, setPlan] = useState<BusinessPlanInput>(catalog.scenarios[0]!.plan);
  const [preset, setPreset] = useState<string>(catalog.scenarios[0]!.id);
  const [seed, setSeed] = useState("autumn-940");
  const [seasonWeeks, setSeasonWeeks] = useState(26);
  const [pause, setPause] = useState<PauseMode>("decisions");
  const [mode, setMode] = useState<ViewMode>("dm");
  const [licensing, setLicensing] = useState<"approve" | "delay" | "deny">("approve");
  const [inspections, setInspections] = useState<"uphold" | "lenient">("uphold");
  const [session, setSession] = useState<Session | null>(null);
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [issues, setIssues] = useState<{ path: string; message: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [previous, setPrevious] = useState<RunSummary | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const s = load();
    if (s) {
      setPlan(s.plan);
      setSeed(s.seed);
      setSeasonWeeks(s.weeks);
      setPreset("");
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) save({ plan, seed, weeks: seasonWeeks });
  }, [plan, seed, seasonWeeks, hydrated]);

  const elapsed = resp?.view.clock.daysElapsed ?? 0;
  const blocked = !!resp && resp.view.status === "paused";
  const effectivePlan = session ? (session.planChanges[session.planChanges.length - 1]?.plan ?? session.basePlan) : null;
  const planDirty = !!session && !!effectivePlan && !same(plan, effectivePlan);

  const call = useCallback(
    async (next: Session, view: ViewMode, opts: { fresh?: boolean } = {}) => {
      setBusy(true);
      setIssues([]);
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            plan: next.basePlan,
            planChanges: next.planChanges,
            seed,
            days: next.target,
            pause: next.pause,
            resolutions: next.resolutions,
            acknowledged: next.acknowledged,
            digestFromOffset: next.digestFrom,
            stopWhenNeededFromOffset: next.stopFrom,
            view,
            sandbox: { licensingOutcome: licensing, inspectionRulings: inspections },
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          setIssues(json.issues ?? [{ path: "", message: json.error ?? "Request failed" }]);
          return;
        }
        if (opts.fresh && resp && resp.view.status === "completed" && resp.view.clock.daysElapsed >= 7) setPrevious(summarizeView(resp.view, "previous"));
        setResp(json as ApiResponse);
        setSession(next);
      } catch (e) {
        setIssues([{ path: "", message: e instanceof Error ? e.message : String(e) }]);
      } finally {
        setBusy(false);
      }
    },
    [seed, licensing, inspections, resp],
  );

  /** Start over from day 0 with the current plan and run `days` days. */
  const runFresh = (days: number) =>
    call({ basePlan: plan, planChanges: [], target: days, resolutions: {}, acknowledged: [], digestFrom: 0, pause }, mode, { fresh: true });

  /** Move the clock forward from where it stands. */
  const advance = (days: number, untilNeeded = false) => {
    if (!session) {
      call({ basePlan: plan, planChanges: [], target: days, resolutions: {}, acknowledged: [], digestFrom: 0, stopFrom: untilNeeded ? 0 : undefined, pause }, mode);
      return;
    }
    call({ ...session, target: elapsed + days, digestFrom: elapsed, stopFrom: untilNeeded ? elapsed : undefined, pause }, mode);
  };

  const onAnswer = (id: string, option: string, dueNow: boolean) => {
    if (!session) return;
    const next = { ...session, resolutions: { ...session.resolutions, [id]: option } };
    if (dueNow) call(next, mode); // resume the stopped clock
    else setSession(next); // recorded; takes effect at its deadline on the next advance
  };
  const onAcknowledge = (eventId: string) => {
    if (!session) return;
    // Continue toward the original target; don't stop on the same moment again.
    call({ ...session, acknowledged: [...session.acknowledged, eventId], stopFrom: session.stopFrom !== undefined ? elapsed : undefined }, mode);
  };
  const applyPlanChange = () => {
    if (!session) return;
    const changes = session.planChanges.filter((c) => c.dayOffset !== elapsed);
    const next = { ...session, planChanges: [...changes, { dayOffset: elapsed, plan }], digestFrom: elapsed };
    if (elapsed === 0) call({ ...next, basePlan: plan, planChanges: [] }, mode);
    else call(next, mode);
  };
  const switchMode = (m: ViewMode) => {
    setMode(m);
    if (session) call(session, m);
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
  const clockLabel = useMemo(() => {
    if (!resp) return `Not started · first day ${catalog.startDate}`;
    const c = resp.view.clock;
    return c.daysElapsed === 0 ? `Not started · first day ${catalog.startDate}` : `Day ${c.daysElapsed} · ${c.date} · week ${c.weekNumber}, day ${c.dayOfWeek}`;
  }, [resp, catalog.startDate]);
  const advanceDisabled = busy || blocked || planDirty;

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
          {session && elapsed > 0 && <p className="hint">Editing the plan mid-season? Apply the changes from today and the business continues under the new plan.</p>}
        </div>
        <PlanEditor catalog={catalog} plan={plan} onChange={(p) => { setPlan(p); setPreset(""); }} />
      </aside>

      <section className="stack" aria-label="Simulation">
        <div className="panel">
          <div className="runbar">
            <label className="field">
              <span>Seed</span>
              <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} />
            </label>
            <label className="field" style={{ minWidth: 200 }}>
              <span>When a decision comes due</span>
              <select value={pause} onChange={(e) => setPause(e.target.value as PauseMode)}>
                <option value="decisions">Stop and ask</option>
                <option value="decisions-and-major">Stop and ask; also stop on major events</option>
                <option value="never">Don't stop (use standing orders)</option>
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
            <label className="field" style={{ minWidth: 140 }}>
              <span>Inspections (DM)</span>
              <select value={inspections} onChange={(e) => setInspections(e.target.value as typeof inspections)}>
                <option value="uphold">Uphold penalties</option>
                <option value="lenient">Be lenient</option>
              </select>
            </label>
            <div className="field">
              <span>View as</span>
              <div className="seg" role="group" aria-label="View as">
                <button type="button" aria-pressed={mode === "dm"} onClick={() => switchMode("dm")}>DM</button>
                <button type="button" aria-pressed={mode === "player"} onClick={() => switchMode("player")}>Players</button>
              </div>
            </div>
          </div>
          <div className="runbar" style={{ borderTop: "1px solid var(--border)", alignItems: "center" }}>
            <div style={{ minWidth: 220 }}>
              <div className="small muted">Campaign clock (sandbox)</div>
              <strong className="num">{clockLabel}</strong>
            </div>
            <div className="row" role="group" aria-label="Advance the clock">
              <button type="button" className="btn" disabled={advanceDisabled} onClick={() => advance(1)}>+1 day</button>
              <button type="button" className="btn" disabled={advanceDisabled} onClick={() => advance(7)}>+1 week</button>
              <button type="button" className="btn" disabled={advanceDisabled} onClick={() => advance(28)}>+4 weeks</button>
              <button type="button" className="btn btn-primary" disabled={advanceDisabled} onClick={() => advance(56, true)} title="Runs up to 8 weeks, stopping as soon as a decision arises or something major happens">
                Until something needs the party
              </button>
            </div>
            <span className="spacer" />
            <div className="row">
              <select aria-label="Season length" style={{ width: "auto" }} value={seasonWeeks} onChange={(e) => setSeasonWeeks(Number(e.target.value))}>
                <option value={13}>13 weeks</option>
                <option value={26}>26 weeks</option>
                <option value={52}>52 weeks</option>
              </select>
              <button type="button" className="btn" disabled={busy} onClick={() => runFresh(seasonWeeks * 7)}>{resp ? "Restart & run season" : "Run a whole season"}</button>
              {session && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { setSession(null); setResp(null); }}>Reset clock</button>}
            </div>
          </div>
        </div>

        {planDirty && (
          <div className="warnings" role="status">
            <strong>The plan has changed.</strong> {elapsed > 0 ? "Apply it from today and carry on, or restart the season with it." : "Apply it to start from day 0."}
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-primary btn-small" disabled={busy || blocked} onClick={applyPlanChange}>{elapsed > 0 ? `Apply from day ${elapsed + 1}` : "Apply"}</button>
              {elapsed > 0 && <button type="button" className="btn btn-small" disabled={busy} onClick={() => runFresh(Math.max(elapsed, 7))}>Restart to day {Math.max(elapsed, 7)} with this plan</button>}
              <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => effectivePlan && setPlan(effectivePlan)}>Undo edits</button>
            </div>
          </div>
        )}
        {blocked && <p className="small secondary" style={{ marginTop: -6 }}>The clock is stopped — answer below (or note the event) to continue.</p>}

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
            <ResultsView view={resp.view} previous={previous} answers={session?.resolutions ?? {}} onAnswer={onAnswer} onAcknowledge={onAcknowledge} busy={busy} />
          </div>
        ) : (
          <div className="panel empty">
            <p style={{ fontSize: 15, color: "var(--ink)" }}>Set up the pie business on the left, then move the clock.</p>
            <p className="small" style={{ marginTop: 6 }}>
              Advance a day or a week at a time for a normal session, or “until something needs the party” for downtime. “Run a whole season” plays 13–52 weeks in one go. The DM view shows hidden state and why it changes; the players' view shows only what the party would learn.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
