/**
 * The business plan: every decision players control, validated with zod so plans
 * from forms, files or the API can be trusted by the engine.
 */
import { z } from "zod";

export const CHANNEL_TYPES = ["cart", "stall", "delivery", "wholesale"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const STAFF_ROLES = ["vendor", "runner", "guard"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const cp = z.number().finite().min(0);

export const PlanSchema = z
  .object({
    /** 1. Name and identity */
    name: z.string().trim().min(1).max(80),
    identity: z.string().trim().max(280).default(""),
    /** 2. Operating neighborhood */
    neighborhood: z.string().min(1),
    /** 3. Weekly production (pies) and operating rhythm */
    weeklyProduction: z.number().int().min(0).max(5000),
    operatingDays: z.number().int().min(1).max(7),
    /** Extra production multiplier on festival days (festival-oriented businesses). */
    festivalProductionMultiplier: z.number().min(1).max(3).default(1),
    /** Run the constructs past steady work: more output, more strain and breakdowns. */
    constructWorkload: z.enum(["steady", "pushed"]).default("steady"),
    /** 4. Quality and pricing */
    quality: z.number().int().min(1).max(5),
    priceCp: z.number().finite().min(1).max(200),
    /** 5. Distribution: outlets and the share of production sent to each */
    channels: z
      .array(z.object({ type: z.enum(CHANNEL_TYPES), share: z.number().min(0).max(1) }))
      .min(1)
      .max(6),
    /** 6. Employees, compensation and management */
    staff: z
      .array(z.object({ candidateId: z.string().min(1), role: z.enum(STAFF_ROLES), wageCpPerDay: cp.max(500) }))
      .max(8),
    oversight: z.enum(["hands-off", "weekly", "frequent"]),
    /** 7. Licensing and legal compliance */
    compliance: z.enum(["informal", "basic", "full"]),
    /** Whether the magical chefs are publicized. Before their license is approved this draws official attention. */
    constructPublicity: z.enum(["discreet", "showcased"]),
    /** 8. Merchants' Guild relationship */
    guild: z.enum(["none", "associate", "member"]),
    /** 9. Security arrangements */
    security: z.object({
      precautions: z.boolean(),
      /** Voluntary payment to a local crew (cp/week). 0 = none. */
      protectionPaymentCpPerWeek: cp.max(5000),
    }),
    /** 10. Advertising */
    advertisingCpPerWeek: cp.max(5000),
    /** 11. Suppliers and reserves */
    suppliers: z.number().int().min(1).max(3),
    reserveDays: z.number().int().min(0).max(7),
    /** 12. Finance, reinvestment and reserves */
    startingCapitalCp: cp.max(1_000_000),
    finance: z.object({
      /** Keep at least this much cash in the business before paying the party. */
      reserveTargetCp: cp.max(1_000_000),
      /** Share of cash above the reserve target paid out to the party weekly. */
      ownerDrawShare: z.number().min(0).max(1),
      /** Share of weekly profit added to next week's advertising. */
      reinvestAdvertisingShare: z.number().min(0).max(1),
    }),
    /** How staff/players respond to recurring situations when nobody is consulted. */
    standingOrders: z.object({
      protectionDemand: z.enum(["pay", "negotiate", "refuse"]),
      guildNotice: z.enum(["join-associate", "join-member", "refuse"]),
      largeOrder: z.enum(["accept", "decline"]),
      dishonestStaff: z.enum(["dismiss", "warn", "ignore"]),
      rivalTricks: z.enum(["ignore", "seek-mediation"]),
      // Added in v0.2 — defaults keep older plans valid.
      raiseRequest: z.enum(["grant", "partial", "refuse"]).default("partial"),
      festivalPitch: z.enum(["accept", "decline"]).default("accept"),
      supplierExclusive: z.enum(["accept", "decline"]).default("decline"),
      rivalTruce: z.enum(["accept", "decline"]).default("accept"),
      charity: z.enum(["accept", "decline"]).default("accept"),
      fillVacancies: z.enum(["auto", "manual"]).default("auto"),
    }),
  })
  .superRefine((plan, ctx) => {
    const total = plan.channels.reduce((a, c) => a + c.share, 0);
    if (Math.abs(total - 1) > 0.011) {
      ctx.addIssue({ code: "custom", path: ["channels"], message: `Channel shares must sum to 100% (got ${Math.round(total * 100)}%)` });
    }
    const seen = new Set<string>();
    plan.staff.forEach((s, i) => {
      if (seen.has(s.candidateId)) ctx.addIssue({ code: "custom", path: ["staff", i, "candidateId"], message: `${s.candidateId} is hired twice` });
      seen.add(s.candidateId);
    });
  });

export type BusinessPlan = z.infer<typeof PlanSchema>;
export type BusinessPlanInput = z.input<typeof PlanSchema>;

export function parsePlan(input: unknown): BusinessPlan {
  return PlanSchema.parse(input);
}

export function safeParsePlan(input: unknown) {
  return PlanSchema.safeParse(input);
}

/** Normalize channel shares to sum to 1 (useful for UI sliders). */
export function normalizeShares<T extends { share: number }>(channels: T[]): T[] {
  const total = channels.reduce((a, c) => a + c.share, 0);
  if (total <= 0) return channels.map((c, i) => ({ ...c, share: i === 0 ? 1 : 0 }));
  return channels.map((c) => ({ ...c, share: c.share / total }));
}
