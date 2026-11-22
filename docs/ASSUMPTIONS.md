# Provisional assumptions and calibration

Every number in `src/world/` is provisional. This page lists what to calibrate first, the current values, and what the simulation currently does with them. Run `npm run compare -- --runs 30 --weeks 26,52` after changing anything.

## First assumptions to calibrate (priority order)

| # | Question for the table | Current value | Where |
|---|---|---|---|
| 1 | **How much should a successful pie business earn?** The canon anchor is rent of 14 gp/week. Should a well-run business cover the rent, double it, or be a minor side income? | Sound plans earn about 7–23 gp/week after costs | Demand (`baseDailyCustomers`, `referencePriceCp`) in `neighborhoods.ts`; ingredient costs in `assumptions.ts` |
| 2 | **Price of a meat pie** by district. | Fair price: Commons 5 cp, Grand Market 6 cp, High March 16 cp (quality-adjusted ±30%/tier) | `referencePriceCp`, `fairPriceQualitySlope` |
| 3 | **Construct output.** How many pies can three constructs bake in a day, and how far can they be pushed? This caps every strategy, and most good plans hit it. | 70/day each → 210/day; pushed ×1.3 with strain, breakdowns and fire risk (proposed mechanic) | `constructs` in `assumptions.ts`, `events/risk.ts` |
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

## Risk and reward

Bold choices should be **gambles**, with a wider spread of outcomes in both directions. Careful plans should be the narrow, dependable middle. Two kinds of risk behave differently, by design:

- **Bold** (pushing the constructs, showcasing the magical chefs, betting on volume) has real upside and real tails. **Pushing** gives +30% output, but builds construct strain (visible to players as "running hot" warnings) and rushes the baking (a small reputation drag). Strain causes breakdowns, and at high strain a major breakdown can become a **kitchen fire** (closed 4–7 weeks, 150–350 gp of repairs), which happens in roughly one pushed year in six. **Showcasing** draws crowds (occasional "spectacle" weeks, demand ×1.6) but also official attention while the license is pending.
- **Reckless** (skipping permits, guild and security, cheap unsupervised staff) saves a little and invites a lot. Consequences scale with the business: a crew's warning costs 25–45% of a week's takings, an unguarded showdown costs a full week's takings plus your best seller, and repeat inspection offences double and triple the penalties. A guild complaint can suspend a non-member's permit, and a strongbox robbery takes most of a week's takings. Reckless play generates stories rather than profit.

Measured over 52 weeks (40 seeds; 10th / 50th / 90th percentile of total profit):

| Plan | Bad year | Typical | Good year | Notes |
|---|---|---|---|---|
| Careful Grand Market expansion (steady) | 1166 gp | 1199 gp | 1235 gp | narrow and dependable |
| Same plan, constructs **pushed** | ~820 gp | ~1380 gp | ~1465 gp | fire in ~1 year in 6 |
| Low-price Commons, steady | 372 gp | 404 gp | 448 gp | |
| Low-price Commons, **pushed** | ~90 gp | ~460 gp | ~565 gp | net loss in 3% of years, 7% of 26-week seasons |

## Observed behavior (30 seeds each, current calibration)

52 weeks from 1 Harvest 940 (10th / median / 90th percentile profit):

| Strategy | Profit p10 / median / p90 | P(net loss) | Decisions | Notable | Major | Notes |
|---|---|---|---|---|---|---|
| Conservative Commons cart | 556 / 573 / 613 gp | 0% | 9.1 | 11.6 | 2.7 | Meets the Ninepenny Crew in ~90% of years (one slow arc, ~12 weeks of warning) |
| Careful Grand Market expansion | 1154 / 1199 / 1229 gp | 0% | 8.8 | 11.8 | 1.5 | Same ambition as "aggressive", done by the book |
| Aggressive Grand Market expansion | 438 / 832 / 997 gp | 0% (cash < 0 in every run) | 10.6 | 20.6 | 9.2 | Pushed, showcased, reckless: wide spread, ends "failing" in 27% |
| Luxury High March | 1114 / 1309 / 1383 gp | 0% | 8.1 | 14.2 | 1.4 | Thriving and calm |
| Low-price, high-volume (pushed) | 93 / 460 / 567 gp | 3% | 13.2 | 22.4 | 8.8 | Constant rival trouble while it keeps undercutting |
| Paying every fee & protection | 625 / 669 / 699 gp | 0% | 9.2 | 12.0 | 1.4 | Over-insured and under-producing |
| Resilient wholesale | 574 / 595 / 628 gp | 0% | 9.0 | 10.9 | 1.5 | |
| Festival-oriented | 373 / 388 / 412 gp | 0% | 8.9 | 11.2 | 1.4 | |
| Careless Commons (control) | −1316 / −1300 / −1262 gp | 100% | 5.5 | 12.6 | 2.1 | |
| Cheap pies in High March (control) | −997 / −990 / −980 gp | 100% | 4.1 | 12.6 | 2.3 | |

What this shows:

- **Good decisions reliably beat poor ones.** Every sound plan beats both controls in 100% of paired seeds.
- **Bold is a gamble; reckless is a bad bet.** Pushing raises the typical and good years and deepens the bad ones. Cutting corners loses to doing the same thing carefully in every percentile.
- **Not all success attracts hostility.** Quiet, compliant, guild-connected businesses (including the most profitable ones) see little escalation.
- **Pricing and volume are the biggest levers.** The Grand Market sells out at 6–7 cp, so pricing to demand and producing enough matter more than anything else.

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
