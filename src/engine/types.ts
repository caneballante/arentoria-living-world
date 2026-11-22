/**
 * Core types for the Arentoria simulation engine.
 *
 * The engine is generic: it never imports world content. A WorldDefinition (from
 * src/world) supplies the calendar, neighborhoods, assumptions and event library.
 * Everything in WorldState is plain JSON so it can be snapshotted, persisted,
 * diffed and replayed.
 */

import type { CalendarConfig, CalendarDate, Season } from "./calendar";
import type { BusinessPlan, ChannelType, StaffRole } from "./plan";
import type { Provenance } from "./provenance";
import type { Rng } from "./rng";

export type Cp = number;

// ---------------------------------------------------------------------------
// World definition (supplied by src/world)
// ---------------------------------------------------------------------------

export interface DemandProfile {
  /** Potential daily buyers reachable with full awareness at the reference price & quality. */
  baseDailyCustomers: number;
  /** What a typical local considers a fair price (cp) for a pie at the preferred quality. */
  referencePriceCp: number;
  /** How quickly demand falls as price rises above the reference (exponential curve). */
  priceSensitivity: number;
  /** Quality tier (1-5) the neighborhood expects. */
  qualityPreference: number;
  /** How strongly quality differences move demand. */
  qualityWeight: number;
  /** Below this tier demand is additionally penalized (snobbery / food-safety worries). */
  qualityFloor: number;
  qualityFloorPenalty: number;
}

export interface NeighborhoodDef {
  id: string;
  name: string;
  provenance: Provenance;
  description: string;
  demand: DemandProfile;
  /** 0..1 intensity of competing food sellers. */
  competition: number;
  /** 0..1 how actively officials enforce permits and rules. */
  enforcement: number;
  /** 0..1 opportunistic crime / organized crews. */
  crime: number;
  /** 0..1 Merchants' Guild / trade-fellowship presence. */
  guildPresence: number;
  /** Multiplier on visibility gained from operating here (foot traffic). */
  footfall: number;
  /** Channel suitability multipliers. */
  channelFit: Record<ChannelType, number>;
  marketDayMultiplier: number;
  restDayMultiplier: number;
  permitFeeCpPerWeek: number;
  stallFeeCpPerWeek: number;
  /** Fraction of revenue taken as market tax under full compliance. */
  marketTaxRate: number;
  /** Taverns/inns that could plausibly take wholesale pies here. */
  wholesaleAccountPotential: number;
  rivalActorId: string;
  crewActorId: string;
}

export interface ChannelDef {
  type: ChannelType;
  label: string;
  provenance: Provenance;
  staffRole: StaffRole;
  /** Fraction of neighborhood potential this single outlet can reach. */
  trafficShare: number;
  /** 0..1 how much bad weather affects this channel. */
  weatherExposure: number;
  /** Pies one staff member can sell/deliver per day. */
  throughputPerStaff: number;
  fixedCostCpPerWeek: number;
  /** Price tolerance multiplier (delivery customers pay for convenience). */
  pricePremium: number;
  /** Visibility generated per week by having this outlet. */
  visibilityPerWeek: number;
  /** Whether sales here count as visible cash handling (theft/extortion exposure). */
  handlesCash: boolean;
  description: string;
}

export interface StaffCandidate {
  id: string;
  name: string;
  provenance: Provenance;
  roles: StaffRole[];
  /** Public description players see. */
  blurb: string;
  askingWageCpPerDay: number;
  /** Hidden traits (0-100). */
  traits: { competence: number; honesty: number; reliability: number };
}

export interface ActorDef {
  id: string;
  name: string;
  kind: "major-faction" | "trade-group" | "rival-business" | "criminal-crew" | "official-body" | "npc";
  provenance: Provenance;
  description: string;
  neighborhoods?: string[];
}

export interface CanonFact {
  id: string;
  statement: string;
  provenance: Provenance;
  tags: string[];
}

export interface QualityTier {
  tier: number;
  label: string;
  ingredientCostCp: number;
}

export interface ClimateConfig {
  provenance: Provenance;
  meanTempC: number;
  amplitudeC: number;
  /** Day of year with the coldest baseline temperature. */
  coldestDayOfYear: number;
  anomalyPersistence: number;
  anomalyShockSd: number;
  /** Probability tomorrow is wet given today is dry / wet, by season. */
  wetGivenDry: Record<Season, number>;
  wetGivenWet: Record<Season, number>;
  /** Share of wet days that are storms, by season. */
  stormShare: Record<Season, number>;
  snowBelowC: number;
  cloudyShareOfDry: number;
  footTraffic: Record<WeatherCondition, number>;
  transportDisruption: Record<WeatherCondition, number>;
}

export interface MarketConfig {
  provenance: Provenance;
  /** Seasonal ingredient price curves: index = 1 - amplitude*cos(2π(doy - cheapestDoy)/yearLength). */
  meat: { amplitude: number; cheapestDayOfYear: number; shockPersistence: number; shockSd: number };
  grain: { amplitude: number; cheapestDayOfYear: number; shockPersistence: number; shockSd: number };
  meatShareOfIngredients: number;
  fuel: { amplitude: number; dearestDayOfYear: number };
}

export interface EconomicAssumptions {
  provenance: Provenance;
  constructs: { count: number; piesPerDayEach: number; upkeepCpPerWeek: number; pushedCapacityMultiplier: number };
  qualityTiers: QualityTier[];
  fuelCostPerPieCp: number;
  packagingCostPerDeliveredPieCp: number;
  kitchenRentShareCpPerWeek: number;
  marketWageCpPerDay: Record<StaffRole, number>;
  guild: { associateDuesCpPerWeek: number; memberDuesCpPerWeek: number; memberInitiationCp: number; associateInitiationCp: number };
  foodCertificateCpPerWeek: number;
  precautionsCpPerWeek: number;
  supplierPremiumPerExtra: number;
  reserveHoldingRatePerWeek: number;
  demand: {
    awarenessFloor: number;
    reputationMin: number;
    reputationMax: number;
    loyaltyBoostMax: number;
    competitionImpact: number;
    noiseSd: number;
    noiseMin: number;
    noiseMax: number;
    priceFactorCap: number;
    coldBoostThresholdC: number;
    coldBoostPerDegree: number;
    heatThresholdC: number;
    heatPenaltyPerDegree: number;
    showcaseNovelty: number;
    fairPriceQualitySlope: number;
  };
  wholesale: { piesPerAccountPerDay: number; priceFraction: number; maxNewAccountsPerWeek: number; lossPerShortfallWeek: number; initialAccounts: number };
  /** The business account: operating floor, supplier credit and what happens when it runs dry. */
  account: {
    /** Weeks of running costs the account should hold; "safe to withdraw" is anything above this. */
    operatingFloorWeeks: number;
    /** Weeks of ingredients suppliers will extend on credit before refusing to deliver. */
    supplierCreditWeeks: number;
    /** Ingredient price multiplier while the account is overdrawn (buying on credit). */
    arrearsIngredientPremium: number;
    /** Morale lost by each employee for every week wages go out late. */
    unpaidWageMoraleHit: number;
  };
  /** Hidden state of a brand-new business. */
  initialHidden: HiddenState;
  /** Days from simulation start until the constructs' licensing decision (canon: ~six months). */
  licensingDecisionAfterDays: number;
  dynamics: DynamicsAssumptions;
}

export interface DynamicsAssumptions {
  reputation: { adjustRate: number; qualityPerTier: number; valueWeight: number; valueCap: number; serviceWeight: number; stockoutPenalty: number; minExposurePies: number };
  visibility: { decay: number; saturation: number; advertisingScale: number; advertisingWeight: number; wordOfMouthPer1000: number; showcaseBonus: number; start: number };
  loyalty: { adjustRate: number };
  scrutiny: { decay: number; noncompliance: Record<"informal" | "basic" | "full", number>; showcaseUnlicensed: number; entanglement: number };
  guild: { adjustRate: number; targets: Record<"none" | "associate" | "member", number>; nonMemberVisibilityPenalty: number; complianceBonus: number };
  criminal: { decay: number; base: number; precautionsMitigation: number; guardMitigation: number; protectionMitigation: number; maxMitigation: number };
  rival: { decay: number; shareWeight: number; undercutWeight: number; memberDamping: number };
  staff: { moraleAdjustRate: number; wageSensitivity: number; overworkPenalty: number; learningPerWeek: number; competenceHeadroom: number; quitMorale: number; quitAfterWeeks: number };
  skimming: { honestyThreshold: number; baseRate: number; oversight: Record<"hands-off" | "weekly" | "frequent", number> };
  absence: { base: number; unreliability: number; lowMorale: number };
  constructs: { strainPerPushedWeek: number; recoveryRate: number; pushedReputationPenalty: number };
}

export interface WorldDefinition {
  id: string;
  label: string;
  provenance: Provenance;
  calendar: CalendarConfig;
  climate: ClimateConfig;
  market: MarketConfig;
  neighborhoods: Record<string, NeighborhoodDef>;
  channels: Record<ChannelType, ChannelDef>;
  staffPool: StaffCandidate[];
  actors: ActorDef[];
  canon: CanonFact[];
  assumptions: EconomicAssumptions;
  events: ConditionalEventDef[];
  threads: ThreadDef[];
  scheduled: ScheduledEventDef[];
  pacing: PacingConfig;
}

/**
 * Narrative pacing, measured in in-game days (never in real-world sessions). These keep
 * the world from producing a crisis every week without breaking cause and effect: they
 * delay or soften events and always show up as named drivers.
 */
export interface PacingConfig {
  provenance: Provenance;
  /** Minimum days between new player decisions from opportunity/dilemma events. */
  minDaysBetweenPlayerDecisions: number;
  /** After a major event, adverse random events are damped for this many days. */
  quietDaysAfterMajor: number;
  quietHazardMultiplier: number;
  /** Major thread escalations wait at least this long after any major event. */
  minDaysBetweenMajorEscalations: number;
}

// ---------------------------------------------------------------------------
// Events, threads, decisions
// ---------------------------------------------------------------------------

export type Severity = "minor" | "notable" | "major";
export type EventCategory = "scheduled" | "conditional" | "emergent" | "opportunity";
export type EventPhase = "morning" | "evening" | "weekly";

/** A named contribution to a probability or a rate. Drivers make the engine explainable. */
export interface Driver {
  label: string;
  value: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  effects: Effect[];
}

export type DecisionAuthority = "players" | "dm";

export interface DecisionSpec {
  authority: DecisionAuthority;
  prompt: string;
  options: DecisionOption[];
  defaultOptionId: string;
  /** Plan standing-order key consulted when auto-resolving (players' standing instructions). */
  standingOrder?: keyof BusinessPlan["standingOrders"];
  /** Sandbox assumption key consulted when auto-resolving DM decisions. */
  dmAssumption?: keyof SandboxAssumptions;
  /**
   * 0 / omitted: urgent — resolved at the end of the day it arises (pauses the clock).
   * N: can wait — the answer takes effect at the end of day + N; an unanswered decision
   * falls back to the standing order at that deadline.
   */
  respondWithinDays?: number;
}

export interface EventOutcome {
  title?: string;
  severity: Severity;
  /** What players perceive. May be incomplete or misleading relative to dmText. */
  playerText: string;
  /** What is actually happening, for the DM. */
  dmText: string;
  effects: Effect[];
  decision?: DecisionSpec;
  /** Defaults to true. Hidden events still affect the world but players are not told. */
  visibleToPlayers?: boolean;
  /** Suggest the DM consider running this at the table. */
  sessionHook?: string;
}

export interface EventContext {
  world: WorldDefinition;
  state: Readonly<WorldState>;
  date: CalendarDate;
  plan: BusinessPlan;
  neighborhood: NeighborhoodDef;
  derived: DerivedMetrics;
  /** Today's operations (evening phase only). */
  today?: DayRecord;
  /** The week just closed (weekly phase only). */
  week?: WeekAccumulator;
  hasCondition(id: string): boolean;
  actorName(id: string): string;
}

export interface ConditionalEventDef {
  id: string;
  title: string;
  category: EventCategory;
  provenance: Provenance;
  phase: EventPhase;
  cooldownDays: number;
  /** "decision": spaced by pacing.minDaysBetweenPlayerDecisions; "adverse": damped after major events. */
  pacing?: "decision" | "adverse" | "flavor";
  hazard(ctx: EventContext): { probability: number; drivers: Driver[] };
  resolve(ctx: EventContext, rng: Rng): EventOutcome;
}

export interface ScheduledEventDef {
  id: string;
  title: string;
  category: "scheduled" | "opportunity" | "emergent";
  provenance: Provenance;
  resolve(ctx: EventContext, rng: Rng, data: Record<string, number | string>): EventOutcome;
}

export interface ThreadStageDef {
  stage: number;
  title: string;
  /** Progress needed to enter this stage. */
  threshold: number;
  /** A serious escalation: spaced from other major events by pacing rules. */
  major?: boolean;
  /** This stage cannot be entered again within this many days of its last entry. */
  repeatCooldownDays?: number;
  onEnter(ctx: EventContext, rng: Rng): EventOutcome;
}

/**
 * A thread is a multi-stage developing situation (a progress clock). Pressure
 * accumulates daily from world conditions; crossing a threshold advances a stage and
 * fires that stage's event. Negative pressure lets situations cool off.
 */
export interface ThreadDef {
  id: string;
  title: string;
  provenance: Provenance;
  actorId(ctx: EventContext): string;
  /** Weekly-rate pressure contributions (summed, divided across days). */
  pressure(ctx: EventContext): Driver[];
  maxProgress: number;
  /** Progress must fall this far below a stage threshold before the stage recedes. */
  hysteresis: number;
  /** Minimum days between automatic stage changes (prevents flip-flopping). */
  minDwellDays: number;
  stages: ThreadStageDef[];
  /** Narrative when a stage recedes. */
  recede?(ctx: EventContext, fromStage: number): EventOutcome;
}

// ---------------------------------------------------------------------------
// Effects: the shared vocabulary for events, decisions and DM interventions
// ---------------------------------------------------------------------------

export type HiddenVar = keyof HiddenState;

export type ModifierTarget = "demand" | "ingredientCost" | "competition" | "productionCap" | "shortageHazard";

export type LedgerCategory =
  | "revenue"
  | "otherIncome"
  | "ingredients"
  | "fuel"
  | "packaging"
  | "wages"
  | "rent"
  | "permits"
  | "stallFees"
  | "guildDues"
  | "protection"
  | "advertising"
  | "equipment"
  | "taxes"
  | "reserveHolding"
  | "fines"
  | "losses"
  | "otherCosts";

export type Effect =
  | { kind: "adjust"; variable: HiddenVar; delta: number }
  | { kind: "cash"; amountCp: number; category: LedgerCategory; note: string }
  | { kind: "addCondition"; id: string; label: string; durationDays?: number; data?: Record<string, number | string | boolean>; visibleToPlayers: boolean }
  | { kind: "removeCondition"; id: string }
  | { kind: "modifier"; id: string; label: string; target: ModifierTarget; multiplier: number; durationDays: number; channel?: ChannelType }
  | { kind: "thread"; threadId: string; progressDelta?: number; setProgress?: number; setStage?: number; freezeDays?: number }
  | { kind: "schedule"; eventId: string; inDays: number; data?: Record<string, number | string> }
  | { kind: "reveal"; topic: string; text: string }
  | { kind: "staff"; staffId: string; moraleDelta?: number; loyaltyDelta?: number; competenceDelta?: number; remove?: boolean }
  | { kind: "plan"; patch: PlanPatch; note: string }
  | { kind: "suspend"; days: number; reason: string }
  | { kind: "licensing"; status: LicensingStatus; note: string }
  | { kind: "wholesaleAccounts"; delta: number }
  /** Money moved in or out of the business account by the DM (party withdrawals and deposits), or where it is kept. */
  | { kind: "account"; action: "withdraw" | "deposit" | "relocate"; amountCp?: number; location?: string; note: string };

export type PlanPatch = Partial<Omit<BusinessPlan, "standingOrders" | "finance">> & {
  standingOrders?: Partial<BusinessPlan["standingOrders"]>;
  finance?: Partial<BusinessPlan["finance"]>;
};

export type Authority = "simulation" | "standing-order" | "sandbox-assumption" | "dm" | "players";

export interface AppliedChange {
  id: string;
  day: number;
  authority: Authority;
  cause: { kind: "event" | "thread" | "decision" | "intervention" | "scheduled"; refId: string };
  description: string;
  effects: Effect[];
  /** Real-world timestamp; only set for human interventions (keeps simulation runs reproducible). */
  recordedAt?: string;
}

// ---------------------------------------------------------------------------
// Simulation state
// ---------------------------------------------------------------------------

export type WeatherCondition = "clear" | "cloudy" | "rain" | "storm" | "snow";

export interface WeatherState {
  condition: WeatherCondition;
  temperatureC: number;
  anomalyC: number;
}

export interface MarketState {
  meatShock: number;
  grainShock: number;
}

export interface HiddenState {
  reputation: number;
  loyalty: number;
  visibility: number;
  scrutiny: number;
  guildRelation: number;
  criminalAttention: number;
  rivalHostility: number;
  /** Wear on the magical chefs from being pushed past steady work (0 = rested). */
  constructStrain: number;
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  wageCpPerDay: number;
  hiredDay: number;
  competence: number;
  morale: number;
  loyalty: number;
  traits: { honesty: number; reliability: number; competenceCap: number };
  lowMoraleWeeks: number;
  skimmedCp: number;
}

export type LicensingStatus = "pending" | "approved" | "delayed" | "denied";

export interface Condition {
  id: string;
  label: string;
  sinceDay: number;
  untilDay?: number;
  data?: Record<string, number | string | boolean>;
  visibleToPlayers: boolean;
}

export interface Modifier {
  id: string;
  label: string;
  target: ModifierTarget;
  multiplier: number;
  channel?: ChannelType;
  fromDay: number;
  untilDay: number;
}

export interface ThreadState {
  id: string;
  stage: number;
  progress: number;
  peakStage: number;
  frozenUntilDay?: number;
  lastChangeDay: number;
  /** Latest weekly-rate pressure, for explanation. */
  lastPressure: Driver[];
  /** Day each stage was last entered (keyed by stage number). */
  lastEntered?: Record<string, number>;
}

export interface ScheduledEvent {
  id: string;
  eventId: string;
  day: number;
  data: Record<string, number | string>;
}

export interface PendingDecision {
  id: string;
  day: number;
  /** End of this day the decision takes effect (= day for urgent decisions). */
  dueDay: number;
  eventRecordId: string;
  authority: DecisionAuthority;
  prompt: string;
  options: DecisionOption[];
  defaultOptionId: string;
  standingOrder?: string;
  dmAssumption?: string;
}

export interface EventRecord {
  id: string;
  day: number;
  week: number;
  eventId: string;
  title: string;
  category: EventCategory | "thread";
  severity: Severity;
  playerText: string;
  dmText: string;
  visibleToPlayers: boolean;
  probability?: number;
  drivers?: Driver[];
  effects: Effect[];
  decisionId?: string;
  resolution?: { optionId: string; label: string; authority: Authority };
  sessionHook?: string;
  threadId?: string;
  stage?: number;
  provenance: "simulated";
}

export interface KnowledgeItem {
  id: string;
  day: number;
  topic: string;
  text: string;
}

export interface ChannelDayResult {
  channel: ChannelType;
  allocated: number;
  demand: number;
  capacity: number;
  sold: number;
  priceCp: number;
  revenueCp: number;
  stockout: boolean;
  /** Multipliers applied, for explanation. */
  factors: Record<string, number>;
}

export interface DayRecord {
  day: number;
  operating: boolean;
  reason?: string;
  produced: number;
  sold: number;
  waste: number;
  channels: ChannelDayResult[];
  revenueTrueCp: number;
  revenueReportedCp: number;
  skimmedCp: number;
  weather: WeatherState;
  festivals: string[];
  absentStaff: string[];
  shortage: boolean;
  priceIndex: number;
}

export type WeekLedger = Record<LedgerCategory, number>;

export interface WeekAccumulator {
  index: number;
  startDay: number;
  days: DayRecord[];
  ledger: WeekLedger;
  /** Net cash from ordinary trading this week (takings minus running costs). */
  tradingCp?: number;
  withdrawnCp?: number;
  depositedCp?: number;
  cashStartCp: number;
  hiddenStart: HiddenState;
}

export interface DerivedMetrics {
  resilience: number;
  resilienceBreakdown: Driver[];
  financialVulnerability: number;
  vulnerabilityBreakdown: Driver[];
  staffCompetence: number;
  staffMorale: number;
  staffLoyalty: number;
  /** Average weekly fixed costs, used for runway. */
  weeklyFixedCostsCp: number;
  runwayWeeks: number;
}

export interface WeekRecord {
  index: number;
  startDay: number;
  endDay: number;
  produced: number;
  sold: number;
  waste: number;
  stockoutDays: number;
  operatingDays: number;
  channelSold: Partial<Record<ChannelType, number>>;
  ledger: WeekLedger;
  revenueCp: number;
  costsCp: number;
  profitCp: number;
  skimmedCp: number;
  ownerDrawCp: number;
  /** DM-recorded withdrawals and deposits this week (not profit or loss). */
  withdrawnCp: number;
  depositedCp: number;
  accountStatus: AccountStatus;
  /** Operating floor at the end of the week (weeks of running costs). */
  accountFloorCp: number;
  cashStartCp: number;
  cashEndCp: number;
  hiddenStart: HiddenState;
  hiddenEnd: HiddenState;
  drivers: Partial<Record<HiddenVar, Driver[]>>;
  derived: DerivedMetrics;
  staff: { id: string; name: string; role: StaffRole; competence: number; morale: number; loyalty: number; skimmedCp: number }[];
  threads: { id: string; stage: number; progress: number; pressure: number }[];
  wholesaleAccounts: number;
  weather: { conditions: Partial<Record<WeatherCondition, number>>; avgTempC: number };
  festivals: string[];
  avgPriceIndex: number;
  eventIds: string[];
}

export type AccountStatus = "healthy" | "thin" | "overdrawn" | "cut-off";

export interface StatementEntry {
  id: string;
  day: number;
  kind: "trading" | "one-off" | "payout" | "withdrawal" | "deposit" | "note";
  description: string;
  amountCp: number;
  /** Balance immediately after this entry, where it is exactly known. */
  balanceCp?: number;
  authority?: Authority;
}

export interface SandboxAssumptions {
  /** How DM-owned decisions are auto-resolved in unattended runs. */
  licensingOutcome: "approve" | "delay" | "deny";
  inspectionRulings: "uphold" | "lenient";
  /**
   * Unattended runs only: when suppliers have cut the business off, does the party cover
   * the debts at week's end? In real play the DM records deposits instead ("never").
   */
  partyTopUps: "when-cut-off" | "never";
}

export interface WorldState {
  schemaVersion: 1;
  worldId: string;
  /** "sandbox" runs never alter campaign canon. */
  branch: "sandbox";
  seed: string;
  startDay: number;
  /** Next day to be simulated. */
  day: number;
  plan: BusinessPlan;
  sandbox: SandboxAssumptions;
  weather: WeatherState;
  market: MarketState;
  business: {
    status: "operating" | "suspended" | "closed";
    suspendedUntilDay?: number;
    cashCp: number;
    minCashCp: number;
    ownerDrawsCp: number;
    hidden: HiddenState;
    staff: StaffMember[];
    wholesaleAccounts: number;
    licensing: { status: LicensingStatus; decisionDay: number };
    consecutiveLossWeeks: number;
    reinvestAdvertisingCp: number;
    lastWeekProfitCp: number;
    account: {
      /** Where the party keeps the business money (their choice; a label). */
      location: string;
      withdrawnCp: number;
      depositedCp: number;
      statement: StatementEntry[];
    };
  };
  threads: Record<string, ThreadState>;
  conditions: Condition[];
  modifiers: Modifier[];
  scheduled: ScheduledEvent[];
  pending: PendingDecision[];
  cooldowns: Record<string, number>;
  pacing: { lastPlayerDecisionDay: number | null; lastMajorDay: number | null };
  events: EventRecord[];
  history: AppliedChange[];
  knowledge: KnowledgeItem[];
  weeks: WeekRecord[];
  current: WeekAccumulator;
  seq: number;
  /** Ids of scheduled interventions already applied (keeps replays idempotent). */
  appliedInterventions: string[];
}
