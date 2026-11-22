# Provisional assumptions and calibration

Every number in `src/world/` is provisional. This page lists what to calibrate first, the current values, and what the simulation currently does with them. Run `npm run compare -- --runs 30 --weeks 26,52` after changing anything.

## First assumptions to calibrate (priority order)

| # | Question for the table | Current value | Where |
|---|---|---|---|
| 1 | **How much should a successful pie business earn?** The canon anchor is rent of 14 gp/week. Should a well-run business cover the rent, double it, or be a minor side income? | Sound plans earn about 7–23 gp/week after costs | Demand (`baseDailyCustomers`, `referencePriceCp`) in `neighborhoods.ts`; ingredient costs in `assumptions.ts` |
| 2 | **Price of a meat pie** by district. | Fair price: Commons 5 cp, Grand Market 6 cp, High March 16 cp (quality-adjusted ±30%/tier) | `referencePriceCp`, `fairPriceQualitySlope` |
| 3 | **Construct output.** How many pies can three constructs bake in a day? This caps every strategy, and most good plans hit it. | 70/day each → 210/day | `constructs.piesPerDayEach` |
| 4 | **Is luxury in High March meant to be the best strategy?** It currently earns about 2.2× the Commons plan at almost no risk. | High March: 150 buyers/day, quality weight 0.55, low crime | `neighborhoods.ts` (`high-march`) |
| 5 | **How dangerous is the Commons?** Over 52 weeks a busy, law-abiding Commons cart that refuses protection draws the Ninepenny Crew to a warning in ~93% of runs (one slow arc with ~12 weeks of warning signs; a guard prevents it). Too often? | crime 0.55, criminal attention tolerance 25, precautions −25% | `neighborhoods.ts`, `dynamics.criminal`, extortion thread in `events/threads.ts` |
| 6 | **Licensing timeline.** When was the filing? Canon says approval in about six months. | Ruling on day 168 after the sim start (start of week 25) | `licensingDecisionAfterDays` |
| 7 | **Wages and staff.** Is 2 sp/day right for a seller? How honest is the typical hire? | vendor 20 cp, runner 18 cp, guard 40 cp; skimming starts below honesty 50 | `marketWageCpPerDay`, `staff.ts`, `dynamics.skimming` |
| 8 | **Guild dues and permits.** | Associate 2 gp + 1 gp/wk; member 10 gp + 2.5 gp/wk; permits 0.5–1.5 gp/wk | `assumptions.guild`, neighborhood fees |
| 9 | **Kitchen rent share.** Should the business pay part of the canon 14 gp rent? | 25% (3.5 gp/wk) | `kitchenRentShareCpPerWeek` |
| 10 | **Calendar.** Adopt or change the proposed 13×28+1 calendar, month and weekday names, festivals, and the current date. | Start 1 Harvest 940 CY (placeholder) | `world/calendar.ts` |
| 11 | **Pace of events.** Is about one decision every 4–6 in-game weeks right for a well-run business? | ≥ 21 days between opportunity decisions; quiet spell 14 days after major events | `world/pacing.ts`, hazard rates in `world/events/` |

## Pacing (how often things happen)

Pacing is tuned per **in-game time**, never per session: you decide how far the clock runs each session, and the pacing follows. Targets per 52 weeks:

| | Sound plan | Risky plan |
|---|---|---|
| Player decisions | 6–10 (about one every 4–6 weeks) | 12–18 |
| Notable report items | 10–15 | 20–30 |
| Major events / adventure hooks | 2–4 | 6–10 |
| Longest quiet stretch | ≤ 10 weeks | 4–6 weeks |
| Same crisis repeating | rarely | at most 3 times |

Mechanisms (all in `src/world/pacing.ts` and the event library, all explainable):

- **Decision spacing**: opportunity/dilemma decisions are at least 21 days apart and never stack on an unanswered one.
- **Quiet spell**: for 14 days after a major event, adverse random events are damped ×0.4. This appears as a named driver.
- **Major spacing**: serious thread escalations wait at least 14 days after any major event.
- **Repeat cooldowns**: a thread stage can't re-fire for weeks after it last fired.
- **Threats resolve**: the second refused reprisal ends the extortion round. With real security the crew backs off; without it, they do damage first and it becomes a showdown to play at the table. A second sabotage burns a rival feud out for months.
- **Response windows**: most decisions can wait 1–14 days. Urgent ones (a crew at the door, an inspection ruling) stop the clock at once. Unanswered decisions fall back to the standing order at their deadline.
- **Good-news decisions**: raise requests, staff poaching, festival pitches, exclusive supplier deals, rival truces, charity requests, guild invitations, large orders and a caravan commission, so quiet, well-run businesses still have choices to make.

## Observed behavior (30 seeds each, current calibration)

52 weeks from 1 Harvest 940:

| Strategy | Median profit | P(net loss) | Player decisions | Notable | Major | Longest quiet | Notes |
|---|---|---|---|---|---|---|---|
| Conservative Commons cart | 589 gp | 0% | 9.2 | 11.6 | 2.7 | 8.3 wks | Meets the Ninepenny Crew in ~93% of years (one slow arc, ~12 weeks of warning) |
| Aggressive Grand Market | 636 gp | 0% (cash < 0 in 30%) | 10.8 | 19.9 | 7.4 | 5.2 wks | Guild complaint, inspections, extortion and a rival feud every year |
| Luxury High March | 1309 gp | 0% | 8.1 | 14.2 | 1.4 | 8.4 wks | Thriving and calm |
| Low-price, high-volume | 555 gp | 0% | 13.5 | 23.3 | 7.0 | 4.7 wks | Constant rival trouble while it keeps undercutting |
| Paying every fee & protection | 669 gp | 0% | 9.2 | 12.0 | 1.4 | 8.3 wks | |
| Resilient wholesale | 600 gp | 0% | 9.0 | 10.9 | 1.4 | 8.7 wks | |
| Festival-oriented | 388 gp | 0% | 8.9 | 11.2 | 1.4 | 8.7 wks | |
| Careless Commons (control) | −1297 gp | 100% | 5.5 | 12.4 | 2.1 | 8.7 wks | |
| Cheap pies in High March (control) | −989 gp | 100% | 4.1 | 12.5 | 2.3 | 8.0 wks | |

What this shows:

- **Good decisions reliably beat poor ones.** Every sound plan beats both controls in 100% of paired seeds.
- **Risk is paid for in trouble, not ruin.** Since threats now resolve instead of looping, the risky plans earn about as much as careful ones over a year. They do it with two to three times the incidents, cash crunches, showdowns to play at the table, and a rival or crew that never quite goes away. *Design question:* should risky plans also be clearly less profitable? Raising fines, extortion damage or showdown costs would do it.
- **Not all success attracts hostility.** Quiet, compliant, guild-connected businesses (including the most profitable one) see little escalation.
- **Pricing is the biggest lever.** In the sensitivity sweep, the wholesale plan went from 98 gp to 626 gp over 52 weeks by moving price from 6 to 7 cp and production toward the stall.

## Calibration workflow

1. Change a value in `src/world/…`.
2. `npm run sim -- --scenario <id> --view dm` to inspect one season, including the "why" breakdown.
3. `npm run compare -- --runs 30 --weeks 26,52` to check strategy balance.
4. `npm test`. The strategy tests (`tests/strategy.test.ts`) encode the design goals: sound beats poor, success ≠ automatic hostility, risk carries adverse events. If a calibration change breaks them, that is a design conversation, not just a test fix.

## Known simplifications (deliberate for Phase 1)

- Pies are sold the day they are baked. Unsold pies are waste; there is no day-old discount.
- Production is a fixed weekly plan. Players learn from "sold out" and "threw away" reports and adjust it themselves.
- Construct capacity is the only production constraint. Expansion beyond three constructs is not modelled yet.
- One business, one neighborhood at a time. Multi-district operations come later.
- When a showdown is flagged "settle at the table", the simulation freezes that situation and assumes nothing further; the DM records the outcome as an intervention.
- Major factions are named but not yet modelled as actors with goals; local proposed actors carry the conflicts.
- Weekday cycle runs through the intercalary day (design choice; easy to change).
