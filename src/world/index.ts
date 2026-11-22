/**
 * The Arentoria world definition: everything the generic engine needs to simulate the
 * party's pie business. Swap or extend pieces here without touching the engine.
 */
import { validateCalendar } from "../engine/calendar";
import { proposed } from "../engine/provenance";
import type { WorldDefinition } from "../engine/types";
import { actors } from "./actors";
import { assumptions } from "./assumptions";
import { arentorCalendar } from "./calendar";
import { canonFacts } from "./canon";
import { arentoriaClimate, arentoriaMarket } from "./climate";
import { conditionalEvents } from "./events/conditional";
import { festivalPitch, opportunityEvents } from "./events/opportunities";
import { scheduledEvents } from "./events/scheduled";
import { threads } from "./events/threads";
import { channels, neighborhoods } from "./neighborhoods";
import { pacing } from "./pacing";
import { staffPool } from "./staff";

export const arentoria: WorldDefinition = {
  id: "arentoria",
  label: "Arentoria — Living World (Phase 1 sandbox)",
  provenance: proposed("World bundle mixes canon facts with proposed content; each item carries its own provenance."),
  calendar: arentorCalendar,
  climate: arentoriaClimate,
  market: arentoriaMarket,
  neighborhoods,
  channels,
  staffPool,
  actors,
  canon: canonFacts,
  assumptions,
  events: [...conditionalEvents, ...opportunityEvents],
  threads,
  scheduled: [...scheduledEvents, festivalPitch],
  pacing,
};

const calendarProblems = validateCalendar(arentorCalendar);
if (calendarProblems.length) throw new Error(`Calendar config invalid: ${calendarProblems.join("; ")}`);

export { DEFAULT_START, DEFAULT_START_DAY } from "./calendar";
export { scenarios, getScenario } from "./scenarios";
