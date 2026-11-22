import type { Metadata } from "next";
import type { Provenance } from "@/engine/provenance";
import { arentoria } from "@/world";

export const metadata: Metadata = { title: "Canon & assumptions · Arentoria Living World" };

function Prov({ p }: { p: Provenance }) {
  return <span className="prov" title={p.note ?? p.source ?? ""}>{p.status}</span>;
}

/** Server-rendered register of what is canon, what is proposed and what is a tunable assumption. */
export default function WorldPage() {
  const w = arentoria;
  const a = w.assumptions;
  return (
    <div className="stack">
      <div className="panel panel-pad">
        <h2>Canon & assumptions</h2>
        <p className="secondary" style={{ marginTop: 4 }}>
          Every item carries a provenance label: <span className="prov">canon</span> established in play or campaign documents · <span className="prov">proposed</span> drafted worldbuilding, not canon until the DM adopts it ·{" "}
          <span className="prov">provisional</span> tunable modelling assumptions · <span className="prov">simulated</span> engine output, never canon unless the DM promotes it.
        </p>
      </div>

      <div className="grid-cards">
        <div className="panel panel-pad">
          <h3 style={{ marginBottom: 8 }}>Established canon</h3>
          <ul>
            {w.canon.map((c) => <li key={c.id} style={{ marginBottom: 4 }}>{c.statement} <Prov p={c.provenance} /></li>)}
          </ul>
        </div>
        <div className="panel panel-pad">
          <h3 style={{ marginBottom: 8 }}>Actors</h3>
          <ul>
            {w.actors.map((x) => <li key={x.id} style={{ marginBottom: 4 }}><strong>{x.name}</strong> <span className="muted small">{x.kind}</span> <Prov p={x.provenance} /><div className="small secondary">{x.description}</div></li>)}
          </ul>
        </div>
        <div className="panel panel-pad">
          <h3 style={{ marginBottom: 8 }}>Calendar <Prov p={w.calendar.provenance} /></h3>
          <p className="small secondary">{w.calendar.months.length} months × 28 days + {w.calendar.intercalary.map((i) => i.name).join(", ")} = 365 days. Weekdays: {w.calendar.weekdayNames.join(", ")}. Market day: {w.calendar.marketDays.map((d) => w.calendar.weekdayNames[d]).join(", ")}.</p>
          <ol className="small" style={{ marginTop: 6 }}>{w.calendar.months.map((m) => <li key={m.name}>{m.name} <span className="muted">({m.season})</span></li>)}</ol>
          <h3 style={{ margin: "10px 0 6px" }}>Festivals</h3>
          <ul className="small">{w.calendar.festivals.map((f) => <li key={f.id}>{f.name} — {f.description} <Prov p={f.provenance} /></li>)}</ul>
        </div>
      </div>

      <div className="panel panel-pad">
        <h3 style={{ marginBottom: 8 }}>Neighborhoods (modelled)</h3>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Neighborhood</th><th>Potential buyers/day</th><th>Fair price</th><th>Price sensitivity</th><th>Preferred quality</th><th>Quality weight</th><th>Competition</th><th>Enforcement</th><th>Crime</th><th>Guild presence</th><th>Permit/wk</th><th>Stall/wk</th></tr></thead>
            <tbody>
              {Object.values(w.neighborhoods).map((n) => (
                <tr key={n.id}><td>{n.name} <Prov p={n.provenance} /></td><td>{n.demand.baseDailyCustomers}</td><td>{n.demand.referencePriceCp} cp</td><td>{n.demand.priceSensitivity}</td><td>{n.demand.qualityPreference}</td><td>{n.demand.qualityWeight}</td><td>{n.competition}</td><td>{n.enforcement}</td><td>{n.crime}</td><td>{n.guildPresence}</td><td>{n.permitFeeCpPerWeek} cp</td><td>{n.stallFeeCpPerWeek} cp</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>Names are canon; all numbers are provisional. Edit <code>src/world/neighborhoods.ts</code>.</p>
      </div>

      <div className="grid-cards">
        <div className="panel panel-pad">
          <h3 style={{ marginBottom: 8 }}>Key economic assumptions <Prov p={a.provenance} /></h3>
          <dl className="kv">
            <dt>Constructs</dt><dd>{a.constructs.count} (canon) × {a.constructs.piesPerDayEach} pies/day (provisional)</dd>
            <dt>Ingredient cost by tier</dt><dd>{a.qualityTiers.map((t) => `${t.tier}: ${t.ingredientCostCp} cp`).join(" · ")}</dd>
            <dt>Kitchen rent share</dt><dd>{a.kitchenRentShareCpPerWeek} cp/week of the canon 14 gp rent</dd>
            <dt>Market wages</dt><dd>{Object.entries(a.marketWageCpPerDay).map(([k, v]) => `${k} ${v} cp/day`).join(" · ")}</dd>
            <dt>Guild</dt><dd>associate {a.guild.associateDuesCpPerWeek} cp/wk · member {a.guild.memberDuesCpPerWeek} cp/wk</dd>
            <dt>Wholesale</dt><dd>{a.wholesale.piesPerAccountPerDay} pies/account/day at {a.wholesale.priceFraction * 100}% of fair price</dd>
            <dt>Licensing ruling</dt><dd>day {a.licensingDecisionAfterDays} after start (canon: ~6 months after filing)</dd>
          </dl>
          <p className="small muted" style={{ marginTop: 6 }}>Full list: <code>src/world/assumptions.ts</code> · calibration notes in <code>docs/ASSUMPTIONS.md</code>.</p>
        </div>
        <div className="panel panel-pad">
          <h3 style={{ marginBottom: 8 }}>Event library</h3>
          <ul className="small">
            {w.events.map((e) => <li key={e.id}><strong>{e.title}</strong> <span className="muted">{e.category} · {e.phase}</span> <Prov p={e.provenance} /></li>)}
            {w.scheduled.map((e) => <li key={e.id}><strong>{e.title}</strong> <span className="muted">scheduled</span> <Prov p={e.provenance} /></li>)}
          </ul>
          <h3 style={{ margin: "10px 0 6px" }}>Developing situations (threads)</h3>
          <ul className="small">
            {w.threads.map((t) => <li key={t.id}><strong>{t.title}</strong>: {t.stages.map((s) => s.title).join(" → ")} <Prov p={t.provenance} /></li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
