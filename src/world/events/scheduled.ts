/**
 * Scheduled events: fire on a specific day (licensing decisions, deliveries,
 * appointments). Proposed content; the licensing timeline is anchored on canon.
 */
import { canon, proposed } from "../../engine/provenance";
import type { ScheduledEventDef } from "../../engine/types";
import { formatCp } from "./helpers";
import { spareCapacity, unitCostToday } from "./conditional";

export const constructLicenseDecision: ScheduledEventDef = {
  id: "construct-license-decision",
  title: "Construct licensing decision",
  category: "scheduled",
  provenance: canon("Campaign brief", "Canon: approval is expected in about six months. The ruling itself is the DM's call."),
  resolve(ctx) {
    const showcased = ctx.plan.constructPublicity === "showcased";
    return {
      severity: "major",
      playerText: "Galen Vale sends word: the licensing board is ready to rule on the constructs.",
      dmText: "Scheduled licensing ruling. Canon expects approval; choose the outcome (sandbox runs use the sandbox assumption).",
      sessionHook: "A hearing scene with Galen Vale, if the DM wants one.",
      effects: [],
      decision: {
        authority: "dm",
        prompt: "How does the licensing board rule on the constructs?",
        dmAssumption: "licensingOutcome",
        defaultOptionId: "approve",
        options: [
          {
            id: "approve",
            label: "Approve",
            description: "The constructs are licensed for commercial work.",
            effects: [
              { kind: "licensing", status: "approved", note: "License approved" },
              { kind: "reveal", topic: "legal", text: "The constructs' license has been approved." },
              { kind: "adjust", variable: "scrutiny", delta: -10 },
            ],
          },
          {
            id: "delay",
            label: "Delay four weeks",
            description: "The board requests further documentation.",
            effects: [
              { kind: "licensing", status: "delayed", note: "Decision delayed" },
              { kind: "schedule", eventId: "construct-license-decision", inDays: 28 },
              { kind: "reveal", topic: "legal", text: "The licensing board has postponed its ruling by four weeks." },
            ],
          },
          {
            id: "deny",
            label: "Deny",
            description: "The constructs may not be used commercially; appeal is possible.",
            effects: [
              { kind: "licensing", status: "denied", note: "License denied" },
              { kind: "reveal", topic: "legal", text: "The licensing board denied the constructs' license." },
              { kind: "adjust", variable: "scrutiny", delta: showcased ? 20 : 8 },
              ...(showcased ? [{ kind: "plan" as const, patch: { constructPublicity: "discreet" as const }, note: "Constructs withdrawn from public view after denial" }] : []),
            ],
          },
        ],
      },
    };
  },
};

export const largeOrderDelivery: ScheduledEventDef = {
  id: "large-order-delivery",
  title: "Large order due",
  category: "opportunity",
  provenance: proposed(),
  resolve(ctx, _rng, data) {
    const qty = Number(data.qty);
    const price = Number(data.priceCp);
    const spare = spareCapacity(ctx, 3);
    const delivered = Math.min(qty, Math.floor(spare));
    const unit = unitCostToday(ctx);
    const full = delivered >= qty;
    const revenue = Math.round(delivered * price);
    const cost = Math.round(delivered * unit);
    return {
      severity: "notable",
      playerText: full
        ? `Delivered all ${qty} pies to ${String(data.who)}; paid ${formatCp(revenue)}.`
        : `Could only bake ${delivered} of the ${qty} pies promised to ${String(data.who)}. They paid for what arrived, coldly.`,
      dmText: `Large order: spare capacity ${Math.round(spare)} over 3 days vs ${qty} ordered. Revenue ${formatCp(revenue)}, ingredients ${formatCp(cost)}.`,
      effects: [
        { kind: "cash", amountCp: revenue, category: "revenue", note: "Large order" },
        { kind: "cash", amountCp: -cost, category: "ingredients", note: "Large order ingredients" },
        { kind: "adjust", variable: "reputation", delta: full ? 3 : -4 },
        { kind: "adjust", variable: "visibility", delta: full ? 4 : 1 },
        ...(full && ctx.plan.channels.some((c) => c.type === "wholesale") ? [{ kind: "wholesaleAccounts" as const, delta: 1 }] : []),
      ],
    };
  },
};

export const scheduledEvents: ScheduledEventDef[] = [constructLicenseDecision, largeOrderDelivery];
