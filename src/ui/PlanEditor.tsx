"use client";
import type { ReactNode } from "react";
import { formatCp } from "./format";
import type { BusinessPlanInput, Catalog } from "./types";

type Plan = BusinessPlanInput;
type Channel = Plan["channels"][number];
type Hire = Plan["staff"][number];

function Section({ n, title, children, hint }: { n: number | string; title: string; children: ReactNode; hint?: string }) {
  return (
    <fieldset className="section">
      <legend className="section-title" style={{ padding: 0 }}>
        <span className="section-num">{n}</span>
        <h3>{title}</h3>
      </legend>
      <div className="stack" style={{ gap: 10 }}>
        {hint && <p className="hint">{hint}</p>}
        {children}
      </div>
    </fieldset>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1, hint, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; hint?: ReactNode; suffix?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {suffix && <span className="hint"> ({suffix})</span>}
      </span>
      <input type="number" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function Select<T extends string | number>({ label, value, options, onChange, hint }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={String(value)} onChange={(e) => onChange((typeof value === "number" ? Number(e.target.value) : e.target.value) as T)}>
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
        ))}
      </select>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function PlanEditor({ catalog, plan, onChange }: { catalog: Catalog; plan: Plan; onChange: (p: Plan) => void }) {
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => onChange({ ...plan, [k]: v });
  const channelTotal = plan.channels.reduce((a, c) => a + c.share, 0);
  const setChannel = (i: number, patch: Partial<Channel>) => set("channels", plan.channels.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setHire = (i: number, patch: Partial<Hire>) => set("staff", plan.staff.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const neighborhood = catalog.neighborhoods.find((n) => n.id === plan.neighborhood);
  const capacityWeek = Math.floor(catalog.constructs.capacityPerDay * (plan.constructWorkload === "pushed" ? catalog.constructs.pushedMultiplier : 1) * plan.operatingDays);
  const hiredIds = new Set(plan.staff.map((s) => s.candidateId));
  const orders = plan.standingOrders;
  const setOrder = <K extends keyof Plan["standingOrders"]>(k: K, v: Plan["standingOrders"][K]) => set("standingOrders", { ...orders, [k]: v });

  return (
    <div>
      <Section n={1} title="Name & identity">
        <label className="field">
          <span>Business name</span>
          <input type="text" value={plan.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="field">
          <span>Identity / pitch <span className="hint">(flavor for reports)</span></span>
          <textarea value={plan.identity ?? ""} maxLength={280} onChange={(e) => set("identity", e.target.value)} />
        </label>
      </Section>

      <Section n={2} title="Neighborhood">
        <Select label="Where we sell" value={plan.neighborhood} options={catalog.neighborhoods.map((n) => ({ value: n.id, label: n.name }))} onChange={(v) => set("neighborhood", v)} hint={neighborhood?.description} />
        <p className="hint">Not yet modelled: {catalog.unmodelled.join(", ")}. The kitchen is at 17 Dawnfire Promenade, Guildstrand (canon).</p>
      </Section>

      <Section n={3} title="Production">
        <label className="field">
          <span>Pies per week: <strong className="num">{plan.weeklyProduction}</strong> <span className="hint">(constructs can make ~{capacityWeek} over {plan.operatingDays} days)</span></span>
          <input type="range" min={0} max={Math.max(capacityWeek, plan.weeklyProduction)} step={10} value={plan.weeklyProduction} onChange={(e) => set("weeklyProduction", Number(e.target.value))} />
        </label>
        <Select
          label="Construct workload"
          value={plan.constructWorkload ?? "steady"}
          options={[
            { value: "steady", label: `Steady — up to ~${catalog.constructs.capacityPerDay}/day` },
            { value: "pushed", label: `Pushed — up to ~${Math.floor(catalog.constructs.capacityPerDay * catalog.constructs.pushedMultiplier)}/day, with strain` },
          ]}
          onChange={(v) => set("constructWorkload", v)}
          hint="Pushing is a gamble: more pies, rushed baking, breakdowns — and at high strain, a chance of fire."
        />
        <div className="grid-2">
          <Select label="Trading days / week" value={plan.operatingDays} options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: `${d} day${d > 1 ? "s" : ""}` }))} onChange={(v) => set("operatingDays", v)} />
          <NumberField label="Festival-day output ×" value={plan.festivalProductionMultiplier ?? 1} min={1} max={3} step={0.25} onChange={(v) => set("festivalProductionMultiplier", v)} />
        </div>
      </Section>

      <Section n={4} title="Quality & price">
        <Select label="Ingredient quality" value={plan.quality} options={catalog.qualityTiers.map((t) => ({ value: t.tier, label: `${t.tier}. ${t.label} — ${t.costHint}` }))} onChange={(v) => set("quality", v)} />
        <NumberField label="Price per pie" suffix="cp" value={plan.priceCp} min={1} max={200} onChange={(v) => set("priceCp", v)} hint={`${formatCp(plan.priceCp)} each. 1 gp = 10 sp = 100 cp.`} />
      </Section>

      <Section n={5} title="Distribution" hint="Share of each day's pies sent to each outlet. Each outlet needs staff in the right role.">
        {plan.channels.map((c, i) => (
          <div key={i} className="list-row" style={{ gridTemplateColumns: "1fr 90px auto" }}>
            <select aria-label="Outlet type" value={c.type} onChange={(e) => setChannel(i, { type: e.target.value as Channel["type"] })}>
              {catalog.channels.map((ch) => (
                <option key={ch.type} value={ch.type}>{ch.label} ({ch.role})</option>
              ))}
            </select>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <input aria-label="Share percent" type="number" min={0} max={100} value={Math.round(c.share * 100)} onChange={(e) => setChannel(i, { share: Number(e.target.value) / 100 })} />%
            </label>
            <button type="button" className="btn btn-small btn-ghost" aria-label="Remove outlet" disabled={plan.channels.length <= 1} onClick={() => set("channels", plan.channels.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="row">
          <button type="button" className="btn btn-small" onClick={() => set("channels", [...plan.channels, { type: "cart", share: 0 }])} disabled={plan.channels.length >= 6}>+ Add outlet</button>
          <button type="button" className="btn btn-small" onClick={() => set("channels", plan.channels.map((c) => ({ ...c, share: channelTotal > 0 ? c.share / channelTotal : 1 / plan.channels.length })))}>Normalize to 100%</button>
          <span className={`small ${Math.abs(channelTotal - 1) > 0.011 ? "delta-bad" : "muted"}`}>Total {Math.round(channelTotal * 100)}%</span>
        </div>
      </Section>

      <Section n={6} title="Staff & management" hint="Candidates are proposed NPCs. Their honesty, reliability and real skill are hidden — you learn them through play.">
        {plan.staff.map((h, i) => {
          const c = catalog.staff.find((s) => s.id === h.candidateId);
          return (
            <div key={i} className="list-row" style={{ gridTemplateColumns: "1fr 96px auto" }}>
              <select aria-label="Candidate" value={h.candidateId} onChange={(e) => {
                const next = catalog.staff.find((s) => s.id === e.target.value)!;
                setHire(i, { candidateId: next.id, role: (next.roles.includes(h.role) ? h.role : next.roles[0]) as Hire["role"], wageCpPerDay: next.askingWageCpPerDay });
              }}>
                {catalog.staff.filter((s) => s.id === h.candidateId || !hiredIds.has(s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — asks {s.askingWageCpPerDay} cp/day</option>
                ))}
              </select>
              <select aria-label="Role" value={h.role} onChange={(e) => setHire(i, { role: e.target.value as Hire["role"] })}>
                {(c?.roles ?? ["vendor"]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button type="button" className="btn btn-small btn-ghost" aria-label="Dismiss" onClick={() => set("staff", plan.staff.filter((_, j) => j !== i))}>✕</button>
              <span className="hint" style={{ gridColumn: "1 / -1" }}>{c?.blurb}</span>
              <label className="field" style={{ gridColumn: "1 / -1", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <span style={{ whiteSpace: "nowrap" }}>Wage</span>
                <input type="number" min={0} max={500} value={h.wageCpPerDay} onChange={(e) => setHire(i, { wageCpPerDay: Number(e.target.value) })} style={{ maxWidth: 90 }} />
                <span className="hint">cp/day · market rate {catalog.marketWages[h.role]} cp</span>
              </label>
            </div>
          );
        })}
        <button
          type="button"
          className="btn btn-small"
          disabled={plan.staff.length >= catalog.staff.length}
          onClick={() => {
            const next = catalog.staff.find((s) => !hiredIds.has(s.id));
            if (next) set("staff", [...plan.staff, { candidateId: next.id, role: next.roles[0] as Hire["role"], wageCpPerDay: next.askingWageCpPerDay }]);
          }}
        >
          + Hire someone
        </button>
        <Select
          label="Management oversight"
          value={plan.oversight}
          options={[
            { value: "hands-off", label: "Hands-off — trust the staff" },
            { value: "weekly", label: "Weekly — count the takings each week" },
            { value: "frequent", label: "Frequent — party members check in often" },
          ]}
          onChange={(v) => set("oversight", v)}
        />
      </Section>

      <Section n={7} title="Licensing & legal compliance" hint="Canon: the constructs may cook at home while licensing is pending; public sales need further arrangements.">
        <Select
          label="Compliance"
          value={plan.compliance}
          options={[
            { value: "informal", label: "Informal — no permits" },
            { value: "basic", label: "Basic — vendor permit" },
            { value: "full", label: "Full — permit, food certificate, market tax" },
          ]}
          onChange={(v) => set("compliance", v)}
        />
        <Select
          label="The magical chefs"
          value={plan.constructPublicity}
          options={[
            { value: "discreet", label: "Discreet — they cook at home, unseen" },
            { value: "showcased", label: "Showcased — advertise the magic" },
          ]}
          onChange={(v) => set("constructPublicity", v)}
          hint="Showcasing draws crowds — and official attention while the license is pending."
        />
      </Section>

      <Section n={8} title="Merchants' Guild">
        <Select
          label="Membership"
          value={plan.guild}
          options={[
            { value: "none", label: "None — stay independent" },
            { value: "associate", label: `Associate — ${catalog.guild.associate}` },
            { value: "member", label: `Full member — ${catalog.guild.member}` },
          ]}
          onChange={(v) => set("guild", v)}
        />
      </Section>

      <Section n={9} title="Security">
        <label className="check">
          <input type="checkbox" checked={plan.security.precautions} onChange={(e) => set("security", { ...plan.security, precautions: e.target.checked })} />
          Precautions (lockbox, escorts, varied routes) — 30 cp/week
        </label>
        <NumberField label="Voluntary protection payment" suffix="cp/week" value={plan.security.protectionPaymentCpPerWeek} min={0} onChange={(v) => set("security", { ...plan.security, protectionPaymentCpPerWeek: v })} hint="Hire a guard under Staff (role: guard)." />
      </Section>

      <Section n={10} title="Advertising & promotion">
        <NumberField label="Advertising budget" suffix="cp/week" value={plan.advertisingCpPerWeek} min={0} max={5000} step={10} onChange={(v) => set("advertisingCpPerWeek", v)} hint={`${formatCp(plan.advertisingCpPerWeek)} per week: criers, handbills, samples.`} />
      </Section>

      <Section n={11} title="Suppliers & reserves">
        <div className="grid-2">
          <Select label="Suppliers" value={plan.suppliers} options={[1, 2, 3].map((n) => ({ value: n, label: `${n} supplier${n > 1 ? "s" : ""}` }))} onChange={(v) => set("suppliers", v)} hint="More = fewer shortages, slightly dearer." />
          <Select label="Reserve stock" value={plan.reserveDays} options={[0, 1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `${n} day${n === 1 ? "" : "s"}` }))} onChange={(v) => set("reserveDays", v)} hint="Covers short supply gaps." />
        </div>
      </Section>

      <Section n={12} title="Finance & reinvestment">
        <NumberField label="Starting capital" suffix="cp" value={plan.startingCapitalCp} min={0} step={100} onChange={(v) => set("startingCapitalCp", v)} hint={formatCp(plan.startingCapitalCp)} />
        <NumberField label="Cash reserve to keep" suffix="cp" value={plan.finance.reserveTargetCp} min={0} step={100} onChange={(v) => set("finance", { ...plan.finance, reserveTargetCp: v })} hint={formatCp(plan.finance.reserveTargetCp)} />
        <Select
          label="Paying the party"
          value={plan.finance.payoutMode ?? "automatic"}
          options={[
            { value: "automatic", label: "Automatic share above the reserve (sandbox)" },
            { value: "dm-only", label: "Only when the DM records a withdrawal (real play)" },
          ]}
          onChange={(v) => set("finance", { ...plan.finance, payoutMode: v })}
          hint="The business money is kept apart from the party's own purses. Withdrawals and deposits are recorded by the DM on the Account tab."
        />
        <div className="grid-2">
          {(plan.finance.payoutMode ?? "automatic") === "automatic" && <NumberField label="Pay party (share above reserve)" suffix="%" value={Math.round(plan.finance.ownerDrawShare * 100)} min={0} max={100} onChange={(v) => set("finance", { ...plan.finance, ownerDrawShare: v / 100 })} />}
          <NumberField label="Profit into advertising" suffix="%" value={Math.round(plan.finance.reinvestAdvertisingShare * 100)} min={0} max={100} onChange={(v) => set("finance", { ...plan.finance, reinvestAdvertisingShare: v / 100 })} />
        </div>
      </Section>

      <Section n="★" title="Standing orders" hint="What staff do when a decision is due and nobody has answered. With 'Stop and ask', you answer these yourself; decisions that can wait show a deadline.">
        <Select label="If a crew demands protection money" value={orders.protectionDemand} options={[{ value: "pay", label: "Pay" }, { value: "negotiate", label: "Haggle" }, { value: "refuse", label: "Refuse" }]} onChange={(v) => setOrder("protectionDemand", v)} />
        <Select label="If the Fellowship says to join the guild" value={orders.guildNotice} options={[{ value: "join-associate", label: "Join as associate" }, { value: "join-member", label: "Join as full member" }, { value: "refuse", label: "Decline" }]} onChange={(v) => setOrder("guildNotice", v)} />
        <Select label="If a large order comes in" value={orders.largeOrder} options={[{ value: "accept", label: "Accept" }, { value: "decline", label: "Decline" }]} onChange={(v) => setOrder("largeOrder", v)} />
        <Select label="If the takings come up short" value={orders.dishonestStaff} options={[{ value: "dismiss", label: "Dismiss the seller" }, { value: "warn", label: "Have a firm word" }, { value: "ignore", label: "Let it go" }]} onChange={(v) => setOrder("dishonestStaff", v)} />
        <Select label="If a rival plays dirty" value={orders.rivalTricks} options={[{ value: "ignore", label: "Weather it" }, { value: "seek-mediation", label: "Ask the Fellowship to mediate" }]} onChange={(v) => setOrder("rivalTricks", v)} />
        <Select label="If staff ask for a raise (or get a better offer)" value={orders.raiseRequest ?? "partial"} options={[{ value: "grant", label: "Pay what they ask" }, { value: "partial", label: "Meet halfway / appeal to loyalty" }, { value: "refuse", label: "Refuse / let them go" }]} onChange={(v) => setOrder("raiseRequest", v)} />
        <Select label="If offered a festival pitch" value={orders.festivalPitch ?? "accept"} options={[{ value: "accept", label: "Take it" }, { value: "decline", label: "Decline" }]} onChange={(v) => setOrder("festivalPitch", v)} />
        <Select label="If a supplier offers an exclusive deal" value={orders.supplierExclusive ?? "decline"} options={[{ value: "accept", label: "Accept (cheaper, less resilient)" }, { value: "decline", label: "Keep several suppliers" }]} onChange={(v) => setOrder("supplierExclusive", v)} />
        <Select label="If a rival proposes a price truce" value={orders.rivalTruce ?? "accept"} options={[{ value: "accept", label: "Agree" }, { value: "decline", label: "Refuse" }]} onChange={(v) => setOrder("rivalTruce", v)} />
        <Select label="If asked for charity" value={orders.charity ?? "accept"} options={[{ value: "accept", label: "Donate" }, { value: "decline", label: "Decline" }]} onChange={(v) => setOrder("charity", v)} />
        <Select label="If someone leaves" value={orders.fillVacancies ?? "auto"} options={[{ value: "auto", label: "Hire a replacement" }, { value: "manual", label: "Leave it to us" }]} onChange={(v) => setOrder("fillVacancies", v)} />
      </Section>
    </div>
  );
}
