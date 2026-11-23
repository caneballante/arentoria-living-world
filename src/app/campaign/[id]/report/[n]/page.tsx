import { Fragment } from "react";
import { notFound } from "next/navigation";
import { isCampaignId } from "@/campaign/model";
import { formatCp } from "@/engine/math";
import { loadCampaign } from "@/persistence/campaign-files";
import { PrintButton } from "@/ui/PrintButton";
import type { EditionContent } from "@/views/edition";

export const dynamic = "force-dynamic";

const ORDER_LABELS: Record<string, [string, Record<string, string>]> = {
  protectionDemand: ["If a crew demands protection money", { pay: "Pay", negotiate: "Haggle", refuse: "Refuse" }],
  guildNotice: ["If the guild says to join", { "join-associate": "Join as associates", "join-member": "Join as full members", refuse: "Decline" }],
  largeOrder: ["If a big order comes in", { accept: "Accept", decline: "Decline" }],
  dishonestStaff: ["If the takings come up short", { dismiss: "Dismiss the seller", warn: "Have a firm word", ignore: "Let it go" }],
  rivalTricks: ["If a rival plays dirty", { ignore: "Weather it", "seek-mediation": "Ask the Fellowship to mediate" }],
  raiseRequest: ["If staff ask for a raise", { grant: "Pay what they ask", partial: "Meet them partway", refuse: "Refuse" }],
  festivalPitch: ["If offered a festival pitch", { accept: "Take it", decline: "Decline" }],
  supplierExclusive: ["If a supplier offers an exclusive deal", { accept: "Accept", decline: "Keep several suppliers" }],
  rivalTruce: ["If a rival proposes a price truce", { accept: "Agree", decline: "Refuse" }],
  charity: ["If asked for charity", { accept: "Donate", decline: "Decline" }],
  fillVacancies: ["If someone leaves", { auto: "Hire a replacement", manual: "Leave it to us" }],
};
const COMPLIANCE: Record<string, string> = { informal: "No permits", basic: "Vendor permit", full: "Permit, food certificate and market tax" };
const GUILD: Record<string, string> = { none: "Independent", associate: "Guild associates", member: "Full guild members" };

function Edition({ e }: { e: EditionContent }) {
  return (
    <article className="edition">
      <header className="edition-head">
        <div>
          <p className="edition-eyebrow">{e.title} · {e.business.name}</p>
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

      <section className="edition-choices">
        <h2>How we run things</h2>
        <p className="small muted">To change any of this, tell the DM. Business size: {e.choices.size}.</p>
        <dl className="kv">
          <dt>Where</dt><dd>{e.choices.neighborhood}: {e.choices.outlets.map((o) => `${o.label}${e.choices.outlets.length > 1 ? ` (${o.sharePct}%)` : ""}`).join(", ")}</dd>
          <dt>What we bake</dt><dd>{e.choices.quality}, {formatCp(e.choices.priceCp)} a pie, about {e.choices.piesPerWeek} a week, {e.choices.daysOpen} days a week</dd>
          <dt>Who works here</dt><dd>{e.choices.staff.length ? e.choices.staff.map((s) => `${s.name} (${s.role}, ${s.wageCpPerDay} cp a day)`).join("; ") : "Nobody yet"}</dd>
          <dt>The city</dt><dd>{COMPLIANCE[e.choices.compliance] ?? e.choices.compliance}; {GUILD[e.choices.guild] ?? e.choices.guild}{e.choices.precautions ? "; sensible precautions" : ""}</dd>
          <dt>Rainy days</dt><dd>{e.choices.suppliers} supplier{e.choices.suppliers === 1 ? "" : "s"}, {e.choices.reserveDays} day{e.choices.reserveDays === 1 ? "" : "s"} of spare stock</dd>
          <dt>Advertising</dt><dd>{formatCp(e.choices.advertisingCpPerWeek)} a week</dd>
        </dl>
        <h3>While you're away</h3>
        <dl className="kv">
          {Object.entries(e.choices.standingOrders).map(([k, v]) => {
            const label = ORDER_LABELS[k];
            return label ? (
              <Fragment key={k}>
                <dt>{label[0]}</dt>
                <dd>{label[1][v] ?? v}</dd>
              </Fragment>
            ) : null;
          })}
        </dl>
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
