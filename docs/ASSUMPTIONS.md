# Provisional assumptions and calibration

Every number in `src/world/` is provisional. This page lists what to calibrate first, the current values, and what the simulation currently does with them. Run `npm run compare -- --runs 30 --weeks 26,52` after changing anything.

## First assumptions to calibrate (priority order)

| # | Question for the table | Current value | Where |
|---|---|---|---|
| 1 | **How much should a successful pie business earn?** The canon anchor is rent of 14 gp/week. Should a well-run business cover the rent, double it, or be a minor side income? | Sound plans earn about 7–23 gp/week after costs | Demand (`baseDailyCustomers`, `referencePriceCp`) in `neighborhoods.ts`; ingredient costs in `assumptions.ts` |
| 2 | **Price of a meat pie** by district. | Fair price: Commons 5 cp, Grand Market 6 cp, High March 16 cp (quality-adjusted ±30%/tier) | `referencePriceCp`, `fairPriceQualitySlope` |
| 3 | **Construct output.** How many pies can three constructs bake in a day? This caps every strategy, and most good plans hit it. | 70/day each → 210/day | `constructs.piesPerDayEach` |
| 4 | **Is luxury in High March meant to be the best strategy?** It currently earns about 2.2× the Commons plan at almost no risk. | High March: 150 buyers/day, quality weight 0.55, low crime | `neighborhoods.ts` (`high-march`) |
| 5 | **How dangerous is the Commons?** Over 52 weeks a busy, law-abiding Commons cart that refuses protection draws the Ninepenny Crew to a warning in ~67% of runs. Too often? | crime 0.55, criminal attention tolerance 25, precautions −25% | `neighborhoods.ts`, `dynamics.criminal`, extortion thread in `events/threads.ts` |
| 6 | **Licensing timeline.** When was the filing? Canon says approval in about six months. | Ruling on day 168 after the sim start (week 24) | `licensingDecisionAfterDays` |
| 7 | **Wages and staff.** Is 2 sp/day right for a seller? How honest is the typical hire? | vendor 20 cp, runner 18 cp, guard 40 cp; skimming starts below honesty 50 | `marketWageCpPerDay`, `staff.ts`, `dynamics.skimming` |
| 8 | **Guild dues and permits.** | Associate 2 gp + 1 gp/wk; member 10 gp + 2.5 gp/wk; permits 0.5–1.5 gp/wk | `assumptions.guild`, neighborhood fees |
| 9 | **Kitchen rent share.** Should the business pay part of the canon 14 gp rent? | 25% (3.5 gp/wk) | `kitchenRentShareCpPerWeek` |
| 10 | **Calendar.** Adopt or change the proposed 13×28+1 calendar, month and weekday names, festivals, and the current date. | Start 1 Harvest 940 CY (placeholder) | `world/calendar.ts` |

## Observed behavior (30 seeds each, current calibration)

26 weeks from 1 Harvest 940:

| Strategy | Median profit | P(net loss) | Extortion reaches violence | Guild formal complaint | Rival rumors | Inspected |
|---|---|---|---|---|---|---|
| Conservative Commons cart | 273 gp | 0% | 0% | 0% | 0% | 0% |
| Aggressive Grand Market | 326 gp (cash went negative in 60% of runs) | 0% | 100% | 100% | 0% | 100% |
| Luxury High March | 596 gp | 0% | 0% | 0% | 0% | 0% |
| Low-price, high-volume (Commons) | 250 gp | 0% | 97% | 0% | 100% | 0% |
| Paying every fee & protection | 347 gp | 0% | 0% | 0% | 0% | 0% |
| Resilient wholesale | 312 gp | 0% | 0% | 0% | 0% | 0% |
| Festival-oriented | 192 gp | 0% | 0% | 0% | 0% | 0% |
| Careless Commons (control) | −599 gp | 100% | 0% | 0% | 0% | 100% |
| Cheap pies in High March (control) | −470 gp | 100% | 0% | 0% | 0% | 100% |

At 52 weeks the risky plans collapse. Aggressive expansion has a median of −815 gp and ends "failing" in 100% of runs. Low-price ends "failing" in 70%. The sound plans keep earning.

What this shows:

- **Good decisions reliably beat poor ones.** Every sound plan beats both controls in 100% of paired seeds.
- **Risk is a choice.** Aggressive and low-price plans can out-earn the conservative one over a single season, but they carry heavy escalation and cash crises, and they lose over a year.
- **Not all success attracts hostility.** Quiet, compliant, guild-connected businesses (including the most profitable one) see almost no escalation.
- **Pricing is the biggest lever.** In the sensitivity sweep, the wholesale plan went from 98 gp to 626 gp over 52 weeks by moving price from 6 to 7 cp and production toward the stall.
- **Ordinary profitable weeks dominate** for sound plans: about 1–2 adverse events per half-year.

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
- Major factions are named but not yet modelled as actors with goals; local proposed actors carry the conflicts.
- Weekday cycle runs through the intercalary day (design choice; easy to change).
