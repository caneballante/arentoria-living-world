"use client";
/**
 * The DM's campaign desk: the party's real campaign and a test campaign, side by side.
 * Everything is saved on the DM's machine by the server; this page only sends what the
 * DM did (advance, answer, change orders, money in/out, publish) and shows the result.
 */
import { useCallback, useEffect, useState } from "react";
import { PlanEditor } from "./PlanEditor";
import { ResultsView } from "./ResultsView";
import type { BusinessPlanInput, CampaignSummary, CampaignView, Catalog } from "./types";

type Id = "party" | "test";
type ListEntry = { id: Id; exists: false } | { id: Id; exists: true; summary: CampaignSummary };

const LABEL: Record<Id, string> = { party: "The party's campaign", test: "Test campaign" };
const ACTIVE_KEY = "arentoria.campaign.active";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

type StartOptions = { name?: string; scenarioId: string; seed?: string; neighborhood: string; priceCp: number };

function StartForm({ id, catalog, busy, onStart, restarting }: { id: Id; catalog: Catalog; busy: boolean; onStart: (o: StartOptions) => void; restarting?: boolean }) {
  const first = catalog.scenarios[0]!;
  const [name, setName] = useState(first.plan.name);
  const [scenarioId, setScenarioId] = useState(first.id);
  const [neighborhood, setNeighborhood] = useState(first.plan.neighborhood);
  const scenarioPlan = catalog.scenarios.find((s) => s.id === scenarioId)?.plan ?? first.plan;
  const rateFor = (hood: string, quality: number) => catalog.neighborhoods.find((n) => n.id === hood)?.goingRateCp[quality] ?? scenarioPlan.priceCp;
  const [priceCp, setPriceCp] = useState(rateFor(first.plan.neighborhood, first.plan.quality));
  const [seed, setSeed] = useState("");
  const real = id === "party";
  const district = catalog.neighborhoods.find((n) => n.id === neighborhood);
  const usesCart = scenarioPlan.channels.some((c) => c.type === "cart" && c.share > 0);
  const pickScenario = (sid: string) => {
    const p = catalog.scenarios.find((s) => s.id === sid)?.plan ?? first.plan;
    setScenarioId(sid);
    setNeighborhood(p.neighborhood);
    setPriceCp(rateFor(p.neighborhood, p.quality));
  };
  const pickDistrict = (hood: string) => {
    setNeighborhood(hood);
    setPriceCp(rateFor(hood, scenarioPlan.quality));
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      {real && (
        <label className="field">
          <span>Business name</span>
          <input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>Starting plan</span>
        <select value={scenarioId} onChange={(e) => pickScenario(e.target.value)}>
          {catalog.scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <span className="hint">{catalog.scenarios.find((s) => s.id === scenarioId)?.summary}</span>
      </label>
      <div className="grid-2">
        <label className="field">
          <span>District <span className="hint">(the players' choice)</span></span>
          <select value={neighborhood} onChange={(e) => pickDistrict(e.target.value)}>
            {catalog.neighborhoods.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Price per pie <span className="hint">(cp)</span></span>
          <input type="number" min={1} max={200} value={priceCp} onChange={(e) => setPriceCp(Math.max(1, Math.round(Number(e.target.value) || 1)))} />
          <span className="hint">Going rate here for these pies: about {rateFor(neighborhood, scenarioPlan.quality)} cp.</span>
        </label>
      </div>
      {district && <p className="hint" style={{ marginTop: -4 }}>{district.description}</p>}
      {district?.cartNote && usesCart && <div className="warnings">{district.cartNote} A starting cart is likely to lose money there.</div>}
      <label className="field">
        <span>Luck (seed) <span className="hint">optional — leave blank for fresh luck; the same seed and choices always give the same results</span></span>
        <input type="text" value={seed} maxLength={60} onChange={(e) => setSeed(e.target.value)} placeholder="random" />
      </label>
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={busy || (real && !name.trim())} onClick={() => onStart({ ...(real ? { name: name.trim() } : {}), scenarioId, neighborhood, priceCp, ...(seed.trim() ? { seed: seed.trim() } : {}) })}>
          {restarting ? (real ? "Start the real campaign over" : "Restart the test campaign") : real ? "Start the real campaign" : "Start the test campaign"}
        </button>
        <span className="small muted">Starts on {catalog.startDate} (placeholder calendar).</span>
      </div>
    </div>
  );
}

export function CampaignApp({ catalog }: { catalog: Catalog }) {
  const [active, setActive] = useState<Id>("party");
  const [list, setList] = useState<ListEntry[] | null>(null);
  const [data, setData] = useState<CampaignView | null>(null);
  const [plan, setPlan] = useState<BusinessPlanInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [showRestart, setShowRestart] = useState(false);

  const show = useCallback((v: CampaignView) => {
    setData(v);
    setPlan(structuredClone(v.view.state.plan) as BusinessPlanInput);
  }, []);

  const refresh = useCallback(
    async (id: Id) => {
      setError(null);
      const l = await api<{ campaigns: ListEntry[] }>("/api/campaigns");
      setList(l.campaigns);
      const entry = l.campaigns.find((c) => c.id === id);
      if (entry?.exists) show(await api<CampaignView>(`/api/campaigns/${id}`));
      else {
        setData(null);
        setPlan(null);
      }
    },
    [show],
  );

  useEffect(() => {
    let id: Id = "party";
    try {
      const saved = window.localStorage.getItem(ACTIVE_KEY);
      if (saved === "test" || saved === "party") id = saved;
    } catch {
      /* storage unavailable */
    }
    setActive(id);
    refresh(id).catch((e) => setError(String(e instanceof Error ? e.message : e)));
  }, [refresh]);

  const choose = (id: Id) => {
    setActive(id);
    setNotice(null);
    setConfirmUndo(false);
    setShowRestart(false);
    try {
      window.localStorage.setItem(ACTIVE_KEY, id);
    } catch {
      /* fine */
    }
    refresh(id).catch((e) => setError(String(e instanceof Error ? e.message : e)));
  };

  const act = async (body: unknown, message?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      show(await api<CampaignView>(`/api/campaigns/${active}`, body));
      if (message) setNotice(message);
      const l = await api<{ campaigns: ListEntry[] }>("/api/campaigns");
      setList(l.campaigns);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const start = async (o: StartOptions) => {
    setBusy(true);
    setError(null);
    try {
      show(await api<CampaignView>("/api/campaigns", { id: active, ...o }));
      setShowRestart(false);
      setNotice(active === "test" ? "Test campaign started." : "The campaign has begun.");
      const l = await api<{ campaigns: ListEntry[] }>("/api/campaigns");
      setList(l.campaigns);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const entry = list?.find((c) => c.id === active);
  const summary = data?.campaign;
  const view = data?.view;
  const blocked = !!view && view.pending.some((p) => p.dueNow);
  const planDirty = !!plan && !!view && !same(plan, view.state.plan);
  const elapsed = view?.clock.daysElapsed ?? 0;
  const nextReport = (summary?.reports.length ?? 0) + 1;
  const clockLabel = view ? (elapsed === 0 ? `Not started · first day ${catalog.startDate}` : `Day ${elapsed} · ${view.clock.date} · week ${view.clock.weekNumber}, day ${view.clock.dayOfWeek}`) : "";
  const disabled = busy || blocked || planDirty;

  return (
    <div className="stack">
      <div className="panel panel-pad row" style={{ gap: 14, flexWrap: "wrap" }}>
        <div className="seg" role="group" aria-label="Which campaign">
          {(["party", "test"] as Id[]).map((id) => (
            <button key={id} type="button" aria-pressed={active === id} onClick={() => choose(id)}>{LABEL[id]}</button>
          ))}
        </div>
        <span className="small muted">
          {active === "party"
            ? "The real thing. Published reports are what happened; they can't be re-run."
            : "A safe copy for trying things out. Restart it whenever you like; it never touches the real campaign."}
        </span>
      </div>

      {error && <div className="issues" role="alert">{error}</div>}
      {notice && <div className="callout" role="status">{notice}</div>}

      {list && entry && !entry.exists && (
        <div className="panel panel-pad stack" style={{ maxWidth: 640 }}>
          <h2>{active === "party" ? "Start the party's campaign" : "Start a test campaign"}</h2>
          <p className="small">
            {active === "party"
              ? "This is the campaign you'll run for the table. It's saved on this computer (in the project's campaigns folder). You move the clock, review what happened, and publish a report for the players."
              : "Run it exactly like the real campaign: move the clock, answer questions, publish reports, undo them. Restart it any time."}
          </p>
          <StartForm id={active} catalog={catalog} busy={busy} onStart={start} />
        </div>
      )}

      {summary && view && plan && (
        <div className="sandbox">
          <aside className="panel editor" aria-label="Orders">
            <div className="panel-pad stack" style={{ gap: 8, borderBottom: "1px solid var(--border)" }}>
              <h2>Orders</h2>
              <p className="hint">The party's choices. Changes take effect from tomorrow in the story ({elapsed === 0 ? "day 1" : `day ${elapsed + 1}`}).</p>
              {planDirty && (
                <div className="warnings" role="status">
                  <strong>Orders changed.</strong>
                  {elapsed > 0 && plan.neighborhood !== view.state.plan.neighborhood && (
                    <p className="small" style={{ margin: "6px 0 0" }}>
                      This moves the business to {catalog.neighborhoods.find((n) => n.id === plan.neighborhood)?.name}. Nobody there knows you yet and your regulars stay behind. Standing orders end, and the old crew and rival are left behind. About half of your reputation travels with you by word of mouth.
                    </p>
                  )}
                  <div className="row" style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-primary btn-small" disabled={busy || blocked} onClick={() => act({ action: "plan", plan }, "New orders recorded.")}>{elapsed === 0 ? "Use these orders" : `Apply from day ${elapsed + 1}`}</button>
                    <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => setPlan(structuredClone(view.state.plan) as BusinessPlanInput)}>Undo edits</button>
                  </div>
                </div>
              )}
            </div>
            <PlanEditor catalog={catalog} plan={plan} onChange={setPlan} />
          </aside>

          <section className="stack" aria-label="Campaign">
            <div className="panel">
              <div className="runbar" style={{ alignItems: "center" }}>
                <div style={{ minWidth: 240 }}>
                  <div className="small muted">{summary.name} · campaign clock</div>
                  <strong className="num">{clockLabel}</strong>
                  <div className="small muted">
                    {summary.publishedThrough ? `Published through day ${summary.publishedThrough.day} (${summary.publishedThrough.date})` : "Nothing published yet"}
                    {summary.draftDays > 0 ? ` · ${summary.draftDays} unpublished day${summary.draftDays === 1 ? "" : "s"}` : ""}
                  </div>
                </div>
                <div className="row" role="group" aria-label="Advance the clock">
                  <button type="button" className="btn" disabled={disabled} onClick={() => act({ action: "advance", days: 1 })}>+1 day</button>
                  <button type="button" className="btn" disabled={disabled} onClick={() => act({ action: "advance", days: 7 })}>+1 week</button>
                  <button type="button" className="btn" disabled={disabled} onClick={() => act({ action: "advance", days: 28 })}>+4 weeks</button>
                  <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => act({ action: "advance", days: 56, untilNeeded: true })} title="Runs up to 8 weeks, stopping as soon as a decision arises or something major happens">
                    Until something needs the party
                  </button>
                </div>
                <span className="spacer" />
                <label className="field" style={{ minWidth: 190 }}>
                  <span>When a decision comes due</span>
                  <select value={summary.pause} disabled={busy} onChange={(e) => act({ action: "pause", pause: e.target.value })}>
                    <option value="decisions-and-major">Stop and ask; also stop on major events</option>
                    <option value="decisions">Stop and ask</option>
                    <option value="never">Don't stop (use standing orders)</option>
                  </select>
                </label>
              </div>
              {summary.draftDays > 0 && (
                <div className="runbar" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => act({ action: "rewind" }, "Rewound to the last report. Your recorded answers and changes are kept.")}>
                    Rewind to {summary.publishedThrough ? "the last report" : "the start"}
                  </button>
                  <span className="small muted">Nothing after the last report is official yet. Rewind, change something, and run it again.</span>
                </div>
              )}
            </div>

            <div className="panel panel-pad stack" style={{ gap: 10 }}>
              <div className="row">
                <h2>Publish Report {nextReport}</h2>
                <span className="small muted">{summary.draftDays > 0 ? `covers the ${summary.draftDays} day${summary.draftDays === 1 ? "" : "s"} since ${summary.publishedThrough ? "the last report" : "the start"}` : "move the clock forward first"}</span>
              </div>
              <div className="grid-2">
                <label className="field">
                  <span>Answers due by <span className="hint">(real world)</span></span>
                  <input type="text" value={deadline} maxLength={120} placeholder="e.g. Thursday 3 December" onChange={(e) => setDeadline(e.target.value)} />
                </label>
                <label className="field">
                  <span>Note from the DM <span className="hint">(optional, printed in the report)</span></span>
                  <input type="text" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
                </label>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || blocked || planDirty || summary.draftDays === 0}
                  onClick={async () => {
                    if (await act({ action: "publish", deadline, note }, `Report ${nextReport} published. It's locked in; open it below to print or share.`)) {
                      setNote("");
                      setConfirmUndo(false);
                    }
                  }}
                >
                  Publish Report {nextReport}
                </button>
                <span className="small muted">{active === "party" ? "Publishing locks this stretch into the campaign." : "Test campaign: publish freely."}</span>
              </div>
              {blocked && <p className="small secondary">A question is due today. Answer it below before moving on or publishing.</p>}
            </div>

            {summary.reports.length > 0 && (
              <div className="panel panel-pad stack" style={{ gap: 8 }}>
                <h2>Published reports</h2>
                <ul className="report-list">
                  {[...summary.reports].reverse().map((r) => (
                    <li key={r.number} className="row" style={{ gap: 10 }}>
                      <a className="btn btn-small" href={`/campaign/${active}/report/${r.number}`} target="_blank" rel="noreferrer">Report {r.number}</a>
                      <span className="small">{r.from} – {r.to}</span>
                      <span className="small muted">published {r.publishedAt}{r.deadline ? ` · answers by ${r.deadline}` : ""}{r.questions ? ` · ${r.questions} question${r.questions === 1 ? "" : "s"}` : ""}</span>
                    </li>
                  ))}
                </ul>
                {summary.canUndo && (
                  <div className="row">
                    {!confirmUndo ? (
                      <button type="button" className="btn btn-small btn-ghost" disabled={busy} onClick={() => setConfirmUndo(true)}>Undo Report {summary.reports.length}…</button>
                    ) : (
                      <>
                        <span className="small">{active === "party" ? `Undo Report ${summary.reports.length}? It goes back to being a draft (a backup is kept). Only do this if the players haven't seen it.` : `Undo Report ${summary.reports.length}?`}</span>
                        <button type="button" className="btn btn-small" disabled={busy} onClick={async () => { await act({ action: "undo-publish" }, "Report undone. That stretch is a draft again."); setConfirmUndo(false); }}>Yes, undo it</button>
                        <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmUndo(false)}>Keep it</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ opacity: busy ? 0.6 : 1, transition: "opacity 120ms" }}>
              <ResultsView
                view={view}
                previous={null}
                answers={data.answers}
                onAnswer={(decisionId, optionId) => act({ action: "answer", decisionId, optionId })}
                onAcknowledge={(eventId) => act({ action: "acknowledge", eventId })}
                onAccountAction={(entry) => act({ action: "account", entry }, entry.action === "relocate" ? "Noted where the money is kept." : "Recorded. It shows in the account from tomorrow in the story.")}
                busy={busy}
              />
            </div>

            {summary.canStartOver && (
              <div className="panel panel-pad stack" style={{ gap: 8 }}>
                <div className="row">
                  <h2>{active === "test" ? "Restart the test campaign" : "Start over"}</h2>
                  <span className="spacer" />
                  <button type="button" className="btn btn-small btn-ghost" onClick={() => setShowRestart((v) => !v)}>{showRestart ? "Cancel" : active === "test" ? "Restart…" : "Start over…"}</button>
                </div>
                <p className="small muted">
                  {active === "test" ? `Started ${new Date(summary.createdAt).toLocaleDateString()} with “${catalog.scenarios.find((s) => s.id === summary.startScenario)?.label ?? summary.startScenario}”, luck “${summary.seed}”.` : "Allowed until the first report is published. A backup of the current file is kept."}
                </p>
                {showRestart && <StartForm id={active} catalog={catalog} busy={busy} onStart={start} restarting />}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
