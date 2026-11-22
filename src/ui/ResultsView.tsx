"use client";
import { useMemo, useState } from "react";
import { ColumnChart, DriverBars, LineChart, SmallMultiples, type LineSeries } from "./Charts";
import { formatCp, pct, r1 } from "./format";
import type { DmView, EventRecord, HiddenVar, PlayerView } from "./types";

export interface RunSummary {
  label: string;
  totalProfitCp: number;
  ownerDrawsCp: number;
  cashEndCp: number;
  minCashCp: number;
  lossWeeks: number;
  sold: number;
  wasteRate: number;
  cashSeries: number[];
  endReputation?: number;
}

export function summarizeView(v: DmView | PlayerView, label: string): RunSummary {
  const weeks = v.kind === "dm" ? v.state.weeks : v.weeks;
  const produced = weeks.reduce((a, w) => a + w.produced, 0);
  return {
    label,
    totalProfitCp: weeks.reduce((a, w) => a + w.profitCp, 0),
    ownerDrawsCp: v.kind === "dm" ? v.state.business.ownerDrawsCp : v.business.ownerDrawsCp,
    cashEndCp: v.kind === "dm" ? v.state.business.cashCp : v.business.cashCp,
    minCashCp: v.kind === "dm" ? v.state.business.minCashCp : Math.min(...weeks.map((w) => w.cashEndCp), weeks[0] ? weeks[0].cashEndCp : 0),
    lossWeeks: weeks.filter((w) => w.profitCp < 0).length,
    sold: weeks.reduce((a, w) => a + w.sold, 0),
    wasteRate: produced ? weeks.reduce((a, w) => a + w.waste, 0) / produced : 0,
    cashSeries: weeks.map((w) => w.cashEndCp),
    endReputation: v.kind === "dm" ? v.state.business.hidden.reputation : undefined,
  };
}

const SEVERITY: Record<string, { icon: string; label: string; color: string }> = {
  minor: { icon: "○", label: "Minor", color: "var(--muted)" },
  notable: { icon: "◆", label: "Notable", color: "var(--warning)" },
  major: { icon: "▲", label: "Major", color: "var(--critical)" },
  opportunity: { icon: "★", label: "Opportunity", color: "var(--good)" },
};

function SeverityBadge({ severity, category }: { severity: string; category?: string }) {
  const s = category === "opportunity" ? SEVERITY.opportunity! : SEVERITY[severity] ?? SEVERITY.minor!;
  return (
    <span className="badge">
      <span className="badge-dot" style={{ background: s.color }} aria-hidden="true" />
      <span aria-hidden="true">{s.icon}</span> {s.label}
    </span>
  );
}

function Tile({ label, value, delta, goodWhenUp = true, note }: { label: string; value: string; delta?: number | null; goodWhenUp?: boolean; note?: string }) {
  let deltaEl = null;
  if (delta !== undefined && delta !== null && Math.abs(delta) >= 0.5) {
    const good = goodWhenUp ? delta > 0 : delta < 0;
    deltaEl = (
      <div className={`tile-delta ${good ? "delta-good" : "delta-bad"}`}>
        {delta > 0 ? "▲" : "▼"} {formatCp(Math.abs(delta))} vs previous run
      </div>
    );
  }
  return (
    <div className="panel tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {deltaEl}
      {note && <div className="tile-delta">{note}</div>}
    </div>
  );
}

const TONE_ICON = { good: "＋", bad: "−", neutral: "·" } as const;

function Reports({ reports, showBasis }: { reports: { week: number; title: string; dateRange: string; lines: { section: string; tone: "good" | "bad" | "neutral"; text: string; basis?: string }[] }[]; showBasis: boolean }) {
  const [order, setOrder] = useState<"latest" | "oldest">("latest");
  const list = order === "latest" ? [...reports].reverse() : reports;
  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="seg" role="group" aria-label="Order">
          <button type="button" aria-pressed={order === "latest"} onClick={() => setOrder("latest")}>Latest first</button>
          <button type="button" aria-pressed={order === "oldest"} onClick={() => setOrder("oldest")}>From the start</button>
        </div>
        {showBasis && <span className="small muted">DM view: each line shows the simulated condition behind it.</span>}
      </div>
      {list.map((r) => (
        <article key={r.week} className="report">
          <div className="report-head">
            <h3>{r.title}</h3>
            <span className="small muted">{r.dateRange}</span>
          </div>
          <ul className="report-lines">
            {r.lines.map((l, i) => (
              <li key={i}>
                <span className="tone" aria-label={l.tone}>{TONE_ICON[l.tone]}</span>
                <div>
                  <div>{l.text}</div>
                  {showBasis && l.basis && <div className="basis">↳ {l.basis}</div>}
                </div>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

const HIDDEN_ORDER: { key: HiddenVar; label: string }[] = [
  { key: "reputation", label: "Reputation" },
  { key: "loyalty", label: "Customer loyalty" },
  { key: "visibility", label: "Visibility" },
  { key: "scrutiny", label: "Official scrutiny" },
  { key: "guildRelation", label: "Guild relationship" },
  { key: "criminalAttention", label: "Criminal attention" },
  { key: "rivalHostility", label: "Rival hostility" },
  { key: "constructStrain", label: "Construct strain" },
];

type AnyPending = { id: string; prompt: string; dueDate: string; dueNow: boolean; authority?: string; options: { id: string; label: string; description: string }[]; optionEffects?: Record<string, string[]> };

/**
 * Open decisions. Due-now decisions stopped the clock and must be answered to continue.
 * Others can wait until their deadline: answering early just records the choice, which
 * takes effect on the due date (unanswered ones fall back to the standing order).
 */
function OpenDecisions({ view, answers, onAnswer, onAcknowledge, busy }: { view: DmView | PlayerView; answers: Record<string, string>; onAnswer: (id: string, option: string, dueNow: boolean) => void; onAcknowledge: (eventId: string) => void; busy: boolean }) {
  const pending: AnyPending[] = view.pending as AnyPending[];
  const due = pending.filter((p) => p.dueNow);
  const waiting = pending.filter((p) => !p.dueNow);
  const paused = view.kind === "dm"
    ? view.pausedOnEvent && { id: view.pausedOnEvent.id, title: view.pausedOnEvent.title, text: view.pausedOnEvent.playerText, severity: view.pausedOnEvent.severity, category: view.pausedOnEvent.category, dm: `${view.pausedOnEvent.dmText}${view.pausedOnEvent.sessionHook ? ` · Session hook: ${view.pausedOnEvent.sessionHook}` : ""}` }
    : view.stoppedOn && { ...view.stoppedOn, category: undefined, dm: undefined };
  if (!due.length && !waiting.length && !paused) return null;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {paused && !due.length && (
        <div className="callout" role="region" aria-label="Simulation stopped">
          <div className="row"><SeverityBadge severity={paused.severity} category={paused.category} /><strong>Stopped: {paused.title}</strong></div>
          <p style={{ marginTop: 6 }}>{paused.text}</p>
          {paused.dm && <p className="small muted" style={{ marginTop: 4 }}>DM: {paused.dm}</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onAcknowledge(paused.id)}>Noted — keep going</button>
            <span className="small muted">Run it at the table first if you like; the clock waits.</span>
          </div>
        </div>
      )}
      {due.map((p) => (
        <div key={p.id} className="callout" role="region" aria-label="Decision required">
          <div className="row">
            <strong>Decision needed now{p.authority ? ` (${p.authority === "dm" ? "DM ruling" : "players' choice"})` : ""}</strong>
            <span className="small muted">The clock stopped at the end of {p.dueDate}.</span>
          </div>
          <p style={{ marginTop: 6 }}>{p.prompt}</p>
          <div className="option-list">
            {p.options.map((o) => (
              <button key={o.id} type="button" className="option" disabled={busy} onClick={() => onAnswer(p.id, o.id, true)}>
                <strong>{o.label}</strong>
                <span className="small secondary">{o.description}</span>
                {p.optionEffects && <span className="effects">Effects: {p.optionEffects[o.id]?.join("; ") || "none"}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
      {waiting.length > 0 && (
        <div className="panel panel-pad">
          <h3 style={{ marginBottom: 6 }}>Waiting on an answer</h3>
          <p className="small muted" style={{ marginBottom: 8 }}>These can wait. An answer takes effect on its due date; if nobody answers, the standing order applies.</p>
          {waiting.map((p) => {
            const chosen = answers[p.id];
            return (
              <div key={p.id} className="list-row" style={{ marginBottom: 8 }}>
                <div className="row">
                  <strong style={{ flex: 1 }}>{p.prompt}</strong>
                  <span className="badge">answer by {p.dueDate}</span>
                  {p.authority === "dm" && <span className="badge">DM</span>}
                </div>
                <div className="row">
                  {p.options.map((o) => (
                    <button key={o.id} type="button" className={`btn btn-small ${chosen === o.id ? "btn-primary" : ""}`} aria-pressed={chosen === o.id} disabled={busy} onClick={() => onAnswer(p.id, o.id, false)} title={p.optionEffects?.[o.id]?.join("; ") ?? o.description}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {chosen && <span className="small secondary">Answered — takes effect {p.dueDate}.</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DigestPanel({ digest, showBasis }: { digest: { title: string; lines: { tone: "good" | "bad" | "neutral"; text: string; basis?: string }[] }; showBasis: boolean }) {
  return (
    <div className="panel panel-pad" style={{ borderLeft: "4px solid var(--accent)" }}>
      <h3 style={{ marginBottom: 6 }}>{digest.title}</h3>
      <ul className="report-lines">
        {digest.lines.map((l, i) => (
          <li key={i}>
            <span className="tone" aria-label={l.tone}>{TONE_ICON[l.tone]}</span>
            <div>
              <div>{l.text}</div>
              {showBasis && l.basis && <div className="basis">↳ {l.basis}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventsList({ view }: { view: DmView | PlayerView }) {
  const [hideMinor, setHideMinor] = useState(true);
  if (view.kind === "player") {
    const evs = view.events.filter((e) => !hideMinor || e.severity !== "minor");
    return (
      <div>
        <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" checked={hideMinor} onChange={(e) => setHideMinor(e.target.checked)} /> Hide minor events</label>
        {evs.map((e) => (
          <div key={e.id} className="event">
            <div className="small muted">{e.date}<div style={{ marginTop: 4 }}><SeverityBadge severity={e.severity} /></div></div>
            <div>
              <strong>{e.title}</strong>
              <p>{e.text}</p>
              {e.resolution && <p className="small secondary">{e.decidedBy === "us" ? "We decided" : "Outcome"}: {e.resolution}</p>}
            </div>
          </div>
        ))}
        {!evs.length && <p className="muted">Nothing notable happened. Ordinary weeks are allowed.</p>}
        {view.knowledge.length > 0 && (
          <>
            <h3 style={{ margin: "16px 0 6px" }}>What we know</h3>
            <ul>{view.knowledge.map((k, i) => <li key={i}><span className="muted small">{k.date} · {k.topic}</span> — {k.text}</li>)}</ul>
          </>
        )}
      </div>
    );
  }
  const evs = view.state.events.filter((e) => !hideMinor || e.severity !== "minor");
  return (
    <div>
      <label className="check" style={{ marginBottom: 8 }}><input type="checkbox" checked={hideMinor} onChange={(e) => setHideMinor(e.target.checked)} /> Hide minor events (absences, small thefts…)</label>
      {evs.map((e) => <DmEvent key={e.id} e={e} />)}
      {!evs.length && <p className="muted">No events at this filter.</p>}
    </div>
  );
}

function DmEvent({ e }: { e: EventRecord }) {
  return (
    <div className="event">
      <div className="small muted">
        Week {e.week}
        <div style={{ marginTop: 4 }}><SeverityBadge severity={e.severity} category={e.category} /></div>
        {!e.visibleToPlayers && <div className="small" style={{ marginTop: 4 }}>Hidden from players</div>}
      </div>
      <div>
        <strong>{e.title}</strong>
        <p>{e.playerText}</p>
        <p className="small secondary" style={{ marginTop: 2 }}>DM: {e.dmText}</p>
        {e.resolution && <p className="small" style={{ marginTop: 2 }}>Resolved: <strong>{e.resolution.label}</strong> <span className="muted">({e.resolution.authority})</span></p>}
        {e.sessionHook && <p className="small" style={{ marginTop: 2 }}>Session hook: {e.sessionHook}</p>}
        {e.drivers && e.drivers.length > 0 && (
          <details style={{ marginTop: 4 }}>
            <summary className="small">{e.probability !== undefined ? `Why: p = ${pct(e.probability)} that day` : "Pressure at the time"}</summary>
            <DriverBars drivers={e.drivers} />
          </details>
        )}
      </div>
    </div>
  );
}

function Threads({ view }: { view: DmView }) {
  const weeks = view.state.weeks;
  return (
    <div className="grid-cards">
      {Object.values(view.state.threads).map((t) => {
        const meta = view.labels.threads[t.id]!;
        const stageTitle = meta.stages.find((s) => s.stage === t.stage)?.title ?? "Dormant";
        return (
          <div key={t.id} className="panel panel-pad">
            <div className="row"><h3>{meta.title}</h3><span className="spacer" /><span className="small muted">now: {stageTitle}</span></div>
            <div className="track" aria-label={`Stage ${t.stage} of 4, peak ${t.peakStage}`}>
              {[1, 2, 3, 4].map((s) => <span key={s} className={s <= t.stage ? "on" : s <= t.peakStage ? "peak" : ""} title={meta.stages.find((x) => x.stage === s)?.title} />)}
            </div>
            <div className="small muted">{meta.stages.map((s) => s.title).join(" → ")}</div>
            <LineChart labels={weeks.map((w) => `W${w.index}`)} series={[{ name: "Progress", color: "var(--series-1)", values: weeks.map((w) => w.threads.find((x) => x.id === t.id)?.progress ?? 0) }]} height={110} domain={[0, meta.maxProgress]} zeroLine={false} format={(v) => String(Math.round(v))} />
            <div className="small secondary">Current pressure (per week):</div>
            <DriverBars drivers={t.lastPressure} />
            {t.frozenUntilDay !== undefined && t.frozenUntilDay >= view.state.day && <p className="small" style={{ marginTop: 6 }}>Frozen — awaiting in-person resolution.</p>}
          </div>
        );
      })}
    </div>
  );
}

function WeekInspector({ view }: { view: DmView }) {
  const weeks = view.state.weeks;
  const [idx, setIdx] = useState(weeks.length);
  const w = weeks[idx - 1];
  const expl = view.explanations.find((e) => e.week === idx);
  if (!w || !expl) return <p className="muted">No weeks yet.</p>;
  return (
    <div className="stack">
      <label className="field" style={{ maxWidth: 360 }}>
        <span>Week {idx} of {weeks.length}</span>
        <input type="range" min={1} max={weeks.length} value={idx} onChange={(e) => setIdx(Number(e.target.value))} />
      </label>
      <div className="grid-cards">
        {expl.variables.map((v) => (
          <div key={v.variable} className="panel panel-pad">
            <div className="row"><h3>{v.label}</h3><span className="spacer" /><span className="num">{v.from} → <strong>{v.to}</strong></span></div>
            <DriverBars drivers={v.drivers} />
          </div>
        ))}
        <div className="panel panel-pad">
          <div className="row"><h3>Resilience</h3><span className="spacer" /><strong className="num">{Math.round(w.derived.resilience)}</strong></div>
          <p className="small muted">Emerges from the plan; not a player score.</p>
          <DriverBars drivers={w.derived.resilienceBreakdown} max={20} />
        </div>
        <div className="panel panel-pad">
          <div className="row"><h3>Financial vulnerability</h3><span className="spacer" /><strong className="num">{Math.round(w.derived.financialVulnerability)}</strong></div>
          <p className="small muted">Runway {r1(Math.min(w.derived.runwayWeeks, 99))} weeks of fixed costs.</p>
          <DriverBars drivers={w.derived.vulnerabilityBreakdown} max={50} />
        </div>
        <div className="panel panel-pad">
          <h3>Staff (hidden)</h3>
          <table className="data" style={{ marginTop: 6 }}>
            <thead><tr><th>Name</th><th>Skill</th><th>Morale</th><th>Loyalty</th><th>Skimmed</th></tr></thead>
            <tbody>
              {w.staff.map((s) => (
                <tr key={s.id}><td>{s.name} <span className="muted">({s.role})</span></td><td>{Math.round(s.competence)}</td><td>{Math.round(s.morale)}</td><td>{Math.round(s.loyalty)}</td><td>{formatCp(s.skimmedCp)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 6 }}>True traits: {w.staff.map((s) => { const t = view.labels.staff[s.id]?.traits; return t ? `${s.name} honesty ${t.honesty}, reliability ${t.reliability}` : ""; }).join(" · ")}</p>
        </div>
      </div>
    </div>
  );
}

function Ledger({ view }: { view: DmView | PlayerView }) {
  const weeks = view.kind === "dm" ? view.state.weeks : view.weeks;
  const cats = ["ingredients", "fuel", "wages", "rent", "permits", "stallFees", "guildDues", "protection", "advertising", "equipment", "taxes", "reserveHolding", "fines", "losses", "packaging"] as const;
  const totals = Object.fromEntries(cats.map((c) => [c, weeks.reduce((a, w) => a + (w.ledger[c] ?? 0), 0)]));
  const used = cats.filter((c) => totals[c]! > 0);
  return (
    <div className="stack">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Week</th><th>Produced</th><th>Sold</th><th>Waste</th><th>Revenue</th><th>Costs</th><th>Profit</th><th>Paid party</th><th>Cash</th>{view.kind === "dm" && <th>Skimmed</th>}</tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.index}>
                <td>W{w.index}</td><td>{w.produced}</td><td>{w.sold}</td><td>{w.waste}</td><td>{formatCp(w.revenueCp)}</td><td>{formatCp(w.costsCp)}</td>
                <td style={{ color: w.profitCp < 0 ? "var(--critical)" : undefined }}>{formatCp(w.profitCp)}</td><td>{formatCp(w.ownerDrawCp)}</td><td>{formatCp(w.cashEndCp)}</td>
                {view.kind === "dm" && "skimmedCp" in w && <td>{formatCp(w.skimmedCp)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 style={{ marginBottom: 6 }}>Where the money went (whole run)</h3>
        <table className="data" style={{ maxWidth: 420 }}>
          <tbody>
            {used.sort((a, b) => totals[b]! - totals[a]!).map((c) => (
              <tr key={c}><td>{c.replace(/([A-Z])/g, " $1").toLowerCase()}</td><td>{formatCp(totals[c]!)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Audit({ view }: { view: DmView }) {
  const rows = view.state.history.filter((h) => h.cause.kind === "decision" || h.cause.kind === "intervention" || h.effects.some((e) => e.kind === "plan"));
  return (
    <div>
      <p className="small muted" style={{ marginBottom: 8 }}>Every decision, intervention and plan change, with its authority and effects. Simulation-generated changes are never canon.</p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Day</th><th className="left">Authority</th><th className="left">What</th><th className="left">Effects</th></tr></thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.id}><td>{h.day - view.state.startDay + 1}</td><td className="left">{h.authority}</td><td className="left" style={{ whiteSpace: "normal" }}>{h.description}</td><td className="left" style={{ whiteSpace: "normal" }}>{h.effects.map((e) => e.kind).join(", ")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="muted">No decisions or interventions in this run.</p>}
    </div>
  );
}

type Tab = "overview" | "reports" | "events" | "hidden" | "threads" | "inspector" | "ledger" | "audit";

export function ResultsView({
  view,
  previous,
  answers,
  onAnswer,
  onAcknowledge,
  busy,
}: {
  view: DmView | PlayerView;
  previous: RunSummary | null;
  answers: Record<string, string>;
  onAnswer: (id: string, option: string, dueNow: boolean) => void;
  onAcknowledge: (eventId: string) => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const isDm = view.kind === "dm";
  const summary = useMemo(() => summarizeView(view, "current"), [view]);
  const weeks = isDm ? view.state.weeks : view.weeks;
  const labels = weeks.map((w) => `W${w.index}`);
  const tabs: { id: Tab; label: string }[] = isDm
    ? [
        { id: "overview", label: "Overview" },
        { id: "reports", label: "Weekly reports" },
        { id: "events", label: "Events" },
        { id: "hidden", label: "Hidden state" },
        { id: "threads", label: "Threads" },
        { id: "inspector", label: "Why? (week inspector)" },
        { id: "ledger", label: "Ledger" },
        { id: "audit", label: "Audit trail" },
      ]
    : [
        { id: "overview", label: "Overview" },
        { id: "reports", label: "Weekly reports" },
        { id: "events", label: "News & events" },
        { id: "ledger", label: "Ledger" },
      ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "overview";
  const delta = (k: keyof RunSummary) => (previous ? (summary[k] as number) - (previous[k] as number) : null);
  const reports = isDm ? view.reports : view.reports;
  const latest = reports[reports.length - 1];
  const cashSeries: LineSeries[] = [{ name: "This run", color: "var(--series-1)", values: summary.cashSeries }];
  if (previous && previous.cashSeries.length) cashSeries.push({ name: "Previous run", color: "var(--muted)", values: previous.cashSeries.slice(0, summary.cashSeries.length), dashed: true });

  return (
    <div className="panel">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="panel-pad stack">
        <OpenDecisions view={view} answers={answers} onAnswer={onAnswer} onAcknowledge={onAcknowledge} busy={busy} />
        {activeTab === "overview" && view.digest && <DigestPanel digest={view.digest} showBasis={isDm} />}
        {activeTab === "overview" && (
          <>
            <div className="small muted">
              {view.period.start} → {view.period.end} · {weeks.length} complete week{weeks.length === 1 ? "" : "s"}
              {view.currentWeek.daysElapsed > 0 ? ` + ${view.currentWeek.daysElapsed} day(s) of week ${weeks.length + 1} (sold ${view.currentWeek.sold}, takings ${formatCp(view.currentWeek.takingsCp)} so far)` : ""} · {view.notice}
            </div>
            <div className="tiles">
              <Tile label="Total profit" value={formatCp(summary.totalProfitCp)} delta={delta("totalProfitCp")} />
              <Tile label="Paid to the party" value={formatCp(summary.ownerDrawsCp)} delta={delta("ownerDrawsCp")} />
              <Tile label="Cash at the end" value={formatCp(summary.cashEndCp)} delta={delta("cashEndCp")} />
              <Tile label="Lowest cash" value={formatCp(summary.minCashCp)} delta={delta("minCashCp")} />
              <Tile label="Losing weeks" value={String(summary.lossWeeks)} note={previous ? `previous run: ${previous.lossWeeks}` : undefined} />
              <Tile label="Pies sold" value={summary.sold.toLocaleString()} note={`${pct(summary.wasteRate)} of output wasted`} />
              {isDm && <Tile label="Reputation (hidden)" value={String(Math.round(view.state.business.hidden.reputation))} note={previous?.endReputation !== undefined ? `previous run: ${Math.round(previous.endReputation)}` : "50 = average seller"} />}
              {isDm && weeks.length > 0 && <Tile label="Resilience (derived)" value={String(Math.round(view.state.weeks[view.state.weeks.length - 1]!.derived.resilience))} note="from suppliers, reserves, staff, channels…" />}
            </div>
            {weeks.length === 0 && <p className="muted">Weekly accounts close every seventh day; charts appear after the first full week.</p>}
            {weeks.length > 0 && <div className="grid-cards">
              <div className="panel chart-card">
                <div className="chart-head"><h3>Weekly profit</h3><span className="chart-sub">after all costs</span></div>
                <ColumnChart data={weeks.map((w) => ({ label: `W${w.index}`, value: w.profitCp / 100 }))} format={(v) => `${r1(v)} gp`} />
              </div>
              <div className="panel chart-card">
                <div className="chart-head"><h3>Cash on hand</h3><span className="chart-sub">end of each week, after paying the party</span></div>
                <LineChart labels={labels} series={cashSeries.map((s) => ({ ...s, values: s.values.map((v) => v / 100) }))} format={(v) => `${r1(v)} gp`} />
              </div>
            </div>}
            {isDm && weeks.length > 0 && (
              <div className="panel chart-card">
                <div className="chart-head"><h3>Hidden state</h3><span className="chart-sub">0–100 · players never see these numbers — see “Why?” for causes</span></div>
                <SmallMultiples labels={labels} items={HIDDEN_ORDER.map((h) => ({ name: h.label, values: view.state.weeks.map((w) => w.hiddenEnd[h.key]) }))} />
              </div>
            )}
            {latest && (
              <div className="panel panel-pad">
                <div className="report-head"><h3>Latest report: {latest.title}</h3><span className="small muted">{latest.dateRange}</span></div>
                <Reports reports={[latest]} showBasis={isDm} />
              </div>
            )}
            {!isDm && view.conditions.length > 0 && <p className="small">Ongoing: {view.conditions.join(" · ")}</p>}
          </>
        )}
        {activeTab === "reports" && <Reports reports={reports} showBasis={isDm} />}
        {activeTab === "events" && <EventsList view={view} />}
        {activeTab === "hidden" && isDm && (
          <div className="stack">
            <SmallMultiples labels={labels} items={HIDDEN_ORDER.map((h) => ({ name: h.label, values: view.state.weeks.map((w) => w.hiddenEnd[h.key]) }))} height={110} />
            <div className="panel chart-card">
              <div className="chart-head"><h3>Staff morale</h3><span className="chart-sub">hidden · low morale → absences, skimming, quitting</span></div>
              <LineChart
                labels={labels}
                domain={[0, 100]}
                zeroLine={false}
                series={(view.state.weeks[0]?.staff ?? []).slice(0, 3).map((s, i) => ({ name: s.name, color: ["var(--series-1)", "var(--series-2)", "var(--series-3)"][i]!, values: view.state.weeks.map((w) => w.staff.find((x) => x.id === s.id)?.morale ?? 0) }))}
                format={(v) => String(Math.round(v))}
              />
            </div>
            <div className="panel panel-pad">
              <h3>Active conditions & modifiers</h3>
              <ul>
                {view.state.conditions.map((c) => <li key={c.id}>{c.label} {c.visibleToPlayers ? "" : <span className="muted">(hidden)</span>}</li>)}
                {view.state.modifiers.map((m) => <li key={m.id}>{m.label}: {m.target} ×{m.multiplier}</li>)}
                {!view.state.conditions.length && !view.state.modifiers.length && <li className="muted">None at the end of the run.</li>}
              </ul>
            </div>
          </div>
        )}
        {activeTab === "threads" && isDm && <Threads view={view} />}
        {activeTab === "inspector" && isDm && <WeekInspector key={view.state.weeks.length} view={view} />}
        {activeTab === "ledger" && <Ledger view={view} />}
        {activeTab === "audit" && isDm && <Audit view={view} />}
      </div>
    </div>
  );
}
