/** Type-only bridge so client components can describe server payloads without importing server code. */
export type { AccountView, DmView, PlayerView } from "../views";
export type { Catalog } from "../server/catalog";
export type { BusinessPlanInput } from "../engine/plan";
export type { ScenarioSummary } from "../analysis/batch";
export type { CampaignSummary, CampaignView } from "../campaign/model";
export type { EditionContent } from "../views/edition";
export type { CalendarGuide } from "../views/calendar-guide";
export type { Driver, EventRecord, WeekRecord, HiddenVar } from "../engine/types";

export type ViewMode = "dm" | "player";
export type PauseMode = "never" | "decisions" | "decisions-and-major";
