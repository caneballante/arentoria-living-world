/**
 * Applying effects. This is the single choke point through which events, decisions
 * and DM interventions change the world, which keeps changes auditable.
 *
 * Functions here mutate the working copy of state owned by the runner. Public
 * runner functions always clone their input first, so callers see pure behavior.
 */

import { clamp, clamp100 } from "./math";
import { stageViolations } from "./stage";
import { PlanSchema } from "./plan";
import type { AppliedChange, Authority, Effect, HiddenVar, StatementEntry, WorldDefinition, WorldState } from "./types";

export function nextId(state: WorldState, prefix: string): string {
  state.seq += 1;
  return `${prefix}-${state.seq}`;
}

function statementEntry(state: WorldState, entry: Omit<StatementEntry, "id">): void {
  state.business.account.statement.push({ id: nextId(state, "stmt"), ...entry });
}

export function applyEffect(world: WorldDefinition, state: WorldState, effect: Effect, day: number, authority?: Authority): void {
  const b = state.business;
  switch (effect.kind) {
    case "adjust": {
      b.hidden[effect.variable] = clamp100(b.hidden[effect.variable] + effect.delta);
      return;
    }
    case "cash": {
      b.cashCp += effect.amountCp;
      const cat = effect.amountCp >= 0 ? (effect.category === "revenue" ? "revenue" : "otherIncome") : effect.category;
      state.current.ledger[cat] += Math.abs(effect.amountCp);
      statementEntry(state, { day, kind: "one-off", description: effect.note, amountCp: effect.amountCp, authority });
      return;
    }
    case "account": {
      // Withdrawals and deposits move money between the business and the party. They are not profit or loss.
      if (effect.action === "relocate") {
        b.account.location = effect.location ?? b.account.location;
        statementEntry(state, { day, kind: "note", description: `Money now kept at: ${b.account.location}${effect.note ? ` (${effect.note})` : ""}`, amountCp: 0, authority });
        return;
      }
      const amount = Math.max(0, Math.round(effect.amountCp ?? 0));
      if (effect.action === "withdraw") {
        b.cashCp -= amount;
        b.account.withdrawnCp += amount;
        state.current.withdrawnCp = (state.current.withdrawnCp ?? 0) + amount;
      } else {
        b.cashCp += amount;
        b.account.depositedCp += amount;
        state.current.depositedCp = (state.current.depositedCp ?? 0) + amount;
      }
      statementEntry(state, {
        day,
        kind: effect.action === "withdraw" ? "withdrawal" : "deposit",
        description: effect.note || (effect.action === "withdraw" ? "Withdrawal by the party" : "Deposit by the party"),
        amountCp: effect.action === "withdraw" ? -amount : amount,
        balanceCp: b.cashCp,
        authority,
      });
      return;
    }
    case "addCondition": {
      state.conditions = state.conditions.filter((c) => c.id !== effect.id);
      state.conditions.push({
        id: effect.id,
        label: effect.label,
        sinceDay: day,
        untilDay: effect.durationDays !== undefined ? day + effect.durationDays - 1 : undefined,
        data: effect.data,
        visibleToPlayers: effect.visibleToPlayers,
      });
      return;
    }
    case "removeCondition": {
      state.conditions = state.conditions.filter((c) => c.id !== effect.id);
      return;
    }
    case "modifier": {
      state.modifiers = state.modifiers.filter((m) => m.id !== effect.id);
      state.modifiers.push({
        id: effect.id,
        label: effect.label,
        target: effect.target,
        multiplier: effect.multiplier,
        channel: effect.channel,
        fromDay: day,
        untilDay: day + Math.max(1, effect.durationDays) - 1,
      });
      return;
    }
    case "thread": {
      const t = state.threads[effect.threadId];
      const def = world.threads.find((x) => x.id === effect.threadId);
      if (!t || !def) throw new Error(`Unknown thread ${effect.threadId}`);
      if (effect.setProgress !== undefined) t.progress = effect.setProgress;
      if (effect.progressDelta !== undefined) t.progress += effect.progressDelta;
      t.progress = clamp(t.progress, 0, def.maxProgress);
      if (effect.setStage !== undefined) {
        t.stage = effect.setStage;
        t.lastChangeDay = day;
      }
      if (effect.freezeDays !== undefined) t.frozenUntilDay = day + effect.freezeDays;
      return;
    }
    case "schedule": {
      state.scheduled.push({ id: nextId(state, "sched"), eventId: effect.eventId, day: day + Math.max(1, effect.inDays), data: effect.data ?? {} });
      return;
    }
    case "reveal": {
      state.knowledge.push({ id: nextId(state, "know"), day, topic: effect.topic, text: effect.text });
      return;
    }
    case "staff": {
      const s = b.staff.find((x) => x.id === effect.staffId);
      if (!s) return;
      if (effect.remove) {
        b.staff = b.staff.filter((x) => x.id !== effect.staffId);
        return;
      }
      if (effect.moraleDelta) s.morale = clamp100(s.morale + effect.moraleDelta);
      if (effect.loyaltyDelta) s.loyalty = clamp100(s.loyalty + effect.loyaltyDelta);
      if (effect.competenceDelta) s.competence = clamp100(s.competence + effect.competenceDelta);
      return;
    }
    case "plan": {
      const merged = {
        ...state.plan,
        ...effect.patch,
        standingOrders: { ...state.plan.standingOrders, ...(effect.patch.standingOrders ?? {}) },
        finance: { ...state.plan.finance, ...(effect.patch.finance ?? {}) },
      };
      const revised = PlanSchema.parse(merged);
      // The DM's guard rails: a revision can't make the business bigger than its size allows.
      const tooBig = stageViolations(world, revised);
      if (tooBig.length) throw new Error(`Plan revision exceeds the business size: ${tooBig.join(" ")}`);
      state.plan = revised;
      // Keep the staff roster in sync with the plan's hiring list.
      if (effect.patch.staff) {
        const keep = new Set(state.plan.staff.map((s) => s.candidateId));
        b.staff = b.staff.filter((s) => keep.has(s.id));
        for (const hire of state.plan.staff) {
          const existing = b.staff.find((s) => s.id === hire.candidateId);
          if (existing) {
            existing.wageCpPerDay = hire.wageCpPerDay;
            existing.role = hire.role;
          } else b.staff.push(hireStaff(world, hire.candidateId, hire.role, hire.wageCpPerDay, day));
        }
      }
      return;
    }
    case "suspend": {
      b.status = "suspended";
      b.suspendedUntilDay = Math.max(b.suspendedUntilDay ?? 0, day + effect.days);
      return;
    }
    case "licensing": {
      b.licensing.status = effect.status;
      return;
    }
    case "wholesaleAccounts": {
      b.wholesaleAccounts = Math.max(0, b.wholesaleAccounts + effect.delta);
      return;
    }
  }
}

export function hireStaff(world: WorldDefinition, candidateId: string, role: WorldState["business"]["staff"][number]["role"], wageCpPerDay: number, day: number) {
  const c = world.staffPool.find((x) => x.id === candidateId);
  if (!c) throw new Error(`Unknown staff candidate ${candidateId}`);
  const k = world.assumptions.dynamics.staff;
  return {
    id: c.id,
    name: c.name,
    role,
    wageCpPerDay,
    hiredDay: day,
    competence: c.traits.competence,
    morale: 60,
    loyalty: 35,
    traits: { honesty: c.traits.honesty, reliability: c.traits.reliability, competenceCap: Math.min(100, c.traits.competence + k.competenceHeadroom) },
    lowMoraleWeeks: 0,
    skimmedCp: 0,
  };
}

export function applyChange(
  world: WorldDefinition,
  state: WorldState,
  change: Omit<AppliedChange, "id"> & { authority: Authority },
): AppliedChange {
  // A plan change that moves the business to another district brings the consequences of
  // the move with it, listed in the audit record like any other effect.
  const effects: Effect[] = [];
  for (const e of change.effects) {
    const from = state.plan.neighborhood;
    applyEffect(world, state, e, change.day, change.authority);
    effects.push(e);
    if (e.kind === "plan" && state.plan.neighborhood !== from) {
      for (const m of moveEffects(world, state, from, state.plan.neighborhood)) {
        applyEffect(world, state, m, change.day, change.authority);
        effects.push(m);
      }
    }
  }
  const record: AppliedChange = { id: nextId(state, "chg"), ...change, effects };
  state.history.push(record);
  return record;
}

/** What moving from one district to another does to the business (see assumptions.move). */
export function moveEffects(world: WorldDefinition, state: WorldState, from: string, to: string): Effect[] {
  const m = world.assumptions.move;
  const h = state.business.hidden;
  const start = world.assumptions.initialHidden;
  const fromName = world.neighborhoods[from]?.name ?? from;
  const toName = world.neighborhoods[to]?.name ?? to;
  const toward = (variable: HiddenVar, target: number): Effect => ({ kind: "adjust", variable, delta: Math.round((target - h[variable]) * 100) / 100 });
  const effects: Effect[] = [
    toward("visibility", h.visibility * m.visibilityKept),
    toward("loyalty", h.loyalty * m.regularsKept),
    toward("reputation", 50 + (h.reputation - 50) * m.reputationKept),
    toward("criminalAttention", start.criminalAttention),
    toward("rivalHostility", start.rivalHostility),
    ...m.localThreads.filter((id) => state.threads[id]).map((id): Effect => ({ kind: "thread", threadId: id, setProgress: 0, setStage: 0, freezeDays: 0 })),
    ...(state.business.wholesaleAccounts > 0 ? [{ kind: "wholesaleAccounts", delta: -state.business.wholesaleAccounts } as Effect] : []),
    { kind: "reveal", topic: "business", text: `We moved to ${toName}. Nobody there knows us yet, and our regulars stayed behind in ${fromName}.` },
  ];
  return effects.filter((e) => !(e.kind === "adjust" && Math.abs(e.delta) < 0.01));
}

/** Human-readable one-line description of an effect (for audit logs and DM tooling). */
export function describeEffect(e: Effect): string {
  switch (e.kind) {
    case "adjust":
      return `${e.variable} ${e.delta >= 0 ? "+" : ""}${Math.round(e.delta * 10) / 10}`;
    case "cash":
      return `cash ${e.amountCp >= 0 ? "+" : ""}${Math.round(e.amountCp)} cp (${e.note})`;
    case "addCondition":
      return `condition + ${e.label}${e.durationDays ? ` for ${e.durationDays}d` : ""}`;
    case "removeCondition":
      return `condition − ${e.id}`;
    case "modifier":
      return `${e.target}${e.channel ? `[${e.channel}]` : ""} ×${e.multiplier} for ${e.durationDays}d (${e.label})`;
    case "thread":
      return `thread ${e.threadId}${e.progressDelta !== undefined ? ` ${e.progressDelta >= 0 ? "+" : ""}${e.progressDelta}` : ""}${e.setProgress !== undefined ? ` progress=${e.setProgress}` : ""}${e.setStage !== undefined ? ` stage=${e.setStage}` : ""}${e.freezeDays ? ` frozen ${e.freezeDays}d` : ""}`;
    case "schedule":
      return `schedule ${e.eventId} in ${e.inDays}d`;
    case "reveal":
      return `reveal to players: ${e.text}`;
    case "staff":
      return `staff ${e.staffId}${e.remove ? " leaves" : ""}${e.moraleDelta ? ` morale ${e.moraleDelta}` : ""}${e.loyaltyDelta ? ` loyalty ${e.loyaltyDelta}` : ""}`;
    case "plan":
      return `plan change: ${e.note}`;
    case "suspend":
      return `operations suspended ${e.days}d (${e.reason})`;
    case "licensing":
      return `construct licensing → ${e.status}`;
    case "wholesaleAccounts":
      return `wholesale accounts ${e.delta >= 0 ? "+" : ""}${e.delta}`;
    case "account":
      return e.action === "relocate" ? `business money now kept at: ${e.location}` : `${e.action} ${Math.round(e.amountCp ?? 0)} cp (${e.note})`;
  }
}
