import { notFound } from "next/navigation";
import { isCampaignId } from "@/campaign/model";
import { formatCp } from "@/engine/math";
import { loadCampaign } from "@/persistence/campaign-files";
import { PrintButton } from "@/ui/PrintButton";
import type { EditionContent } from "@/views/edition";

export const dynamic = "force-dynamic";

const CITY: Record<string, string> = { informal: "No permits", basic: "A vendor's permit", full: "Permits in order" };
const GUILD: Record<string, string> = { none: "not in the guild", associate: "guild associates", member: "full guild members" };

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const DAYS = ["", "one day", "two days", "three days", "four days", "five days", "six days", "every day"];

/** "How we run things" in a few plain sentences: no settings, no jargon. */
function runningSummary(e: EditionContent): string[] {
  const c = e.choices;
  const outlets = list(c.outlets.map((o) => `a ${o.label.toLowerCase()}`));
  const pies = c.quality.replace(/^\d+\.\s*/, "");
  const sellers = c.staff.map((s) => s.name);
  return [
    `${outlets.charAt(0).toUpperCase()}${outlets.slice(1)} in ${c.neighborhood}, open ${DAYS[c.daysOpen] ?? `${c.daysOpen} days`} a week.`,
    `${pies} pies at ${formatCp(c.priceCp)} each, about ${c.piesPerWeek} a week.`,
    sellers.length ? `${list(sellers)} ${sellers.length === 1 ? "works" : "work"} for us.` : "Nobody works for us yet.",
    `${CITY[c.compliance] ?? c.compliance}; ${GUILD[c.guild] ?? c.guild}.`,
  ];
}

function Edition({ e }: { e: EditionContent }) {
  return (
    <article className="edition">
      <header className="edition-head">
        <div>
          <p className="edition-eyebrow">{e.business.name} · news for the partners · {e.title}</p>
          <h1>{e.period.from} – {e.period.to}</h1>
          <p className="muted small">{e.business.neighborhood} · {e.period.days} days · published {e.publishedAt}</p>
        </div>
        <PrintButton />
      </header>

      <section className="edition-letter">
        <p className="salute">To the partners of {e.business.name},</p>
        {e.summary.map((l, i) => (
          <p key={i}>{l.text}</p>
        ))}
        {e.note && <p className="dm-note"><strong>From the DM:</strong> {e.note}</p>}
        <p className="sign">— the manager</p>
      </section>

      <section className="edition-figures">
        <div><span>In the strongbox</span><b>{formatCp(e.strongbox.balanceCp)}</b></div>
        <div><span>Safe to take out</span><b>{formatCp(e.strongbox.safeToWithdrawCp)}</b></div>
        <div><span>Pies sold so far</span><b>{e.totals.piesSold.toLocaleString("en-US")}</b></div>
        <div><span>Earned since opening</span><b>{formatCp(e.totals.earnedCp)}</b></div>
      </section>

      {e.questions.length > 0 && (
        <section className="edition-questions">
          <h2>Your answer is needed</h2>
          {e.deadline && <p><strong>Tell the DM by {e.deadline}.</strong></p>}
          {e.questions.map((q) => (
            <div key={q.id} className="question-card">
              <p className="ask">{q.prompt}</p>
              <ul>
                {q.options.map((o) => (
                  <li key={o.id}><span className="box" aria-hidden="true" /> <strong>{o.label}</strong> <span className="muted">— {o.description}</span></li>
                ))}
              </ul>
              <p className="small muted">In the story, needed by {q.answerBy}.{q.ifNoAnswer ? ` If we don't hear from you: ${q.ifNoAnswer}.` : ""}</p>
            </div>
          ))}
        </section>
      )}

      {e.reports.length > 0 && (
        <section>
          <h2>Week by week</h2>
          {e.reports.map((r) => (
            <div key={r.week} className="report">
              <div className="report-head"><h3>{r.title}</h3><span className="small muted">{r.dateRange}</span></div>
              <ul className="report-lines">
                {r.lines.map((l, i) => (
                  <li key={i}><span className="tone">{l.tone === "good" ? "＋" : l.tone === "bad" ? "−" : "·"}</span><div>{l.text}</div></li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {e.comingUp.length > 0 && (
        <section>
          <h2>Coming up</h2>
          <ul className="plain">{e.comingUp.map((c, i) => <li key={i}><span className="muted small">{c.date}</span> {c.text}</li>)}</ul>
        </section>
      )}

      {e.strongbox.entries.length > 0 && (
        <section>
          <h2>The strongbox</h2>
          <p className="small muted">Kept in: {e.strongbox.location}. Only the DM records money going in or out.</p>
          <table className="ledger-table">
            <tbody>
              {e.strongbox.entries.map((x, i) => (
                <tr key={i}><td className="small muted">{x.date}</td><td>{x.description}{x.by ? <span className="muted small"> · {x.by}</span> : null}</td><td className="num right">{x.amountCp >= 0 ? "+" : "−"}{formatCp(Math.abs(x.amountCp))}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {(e.notices?.length ?? 0) > 0 && (
        <section>
          <h2>Notices</h2>
          <div className="notices">
            {e.notices!.map((n, i) => (
              <div key={i} className={`notice-ad notice-${n.kind}`}>
                <p className="notice-head">{n.headline}</p>
                <p>{n.text}</p>
                {n.price && <p className="notice-price">{n.price}</p>}
                {n.from && <p className="notice-from">— {n.from}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="edition-choices">
        <h2>How we run things</h2>
        <p>{runningSummary(e).join(" ")}</p>
        <p className="small muted">Want to change something? Tell the DM.</p>
      </section>
    </article>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string; n: string }> }) {
  const p = await params;
  if (!isCampaignId(p.id)) notFound();
  const c = await loadCampaign(p.id);
  const e = c?.editions.find((x) => x.number === Number(p.n));
  if (!e) notFound();
  return <Edition e={e.content} />;
}
