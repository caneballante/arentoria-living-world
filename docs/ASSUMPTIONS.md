# Provisional assumptions and calibration

Every number in `src/world/` is provisional. This page lists what to calibrate first, the current values, and what the simulation currently does with them. Run `npm run compare -- --runs 30 --weeks 26,52` after changing anything.

## First assumptions to calibrate (priority order)

| # | Question for the table | Current value | Where |
|---|---|---|---|
| 1 | **How much should a successful pie business earn?** The canon anchor is rent of 14 gp/week. Should a well-run business cover the rent, double it, or be a minor side income? | Sound plans earn about 7–23 gp/week after costs | Demand (`baseDailyCustomers`, `referencePriceCp`) in `neighborhoods.ts`; ingredient costs in `assumptions.ts` |
| 2 | **Price of a meat pie** by district. | Fair price: Shades 4 cp; Commons, Stoneback, Scholarium, Outer Ward 5 cp; Grand Market 6 cp; Crown Ward 12 cp; High March 16 cp (quality-adjusted ±30%/tier) | `referencePriceCp`, `fairPriceQualitySlope` |
| 3 | **Construct output.** How many pies can three constructs bake in a day, and how far can they be pushed? This caps every strategy, and most good plans hit it. | 70/day each → 210/day; pushed ×1.3 with strain, breakdowns and fire risk (proposed mechanic) | `constructs` in `assumptions.ts`, `events/risk.ts` |
| 4 | **Should the rich districts pay twice what the working districts do?** Luxury High March and Crown Ward catering each earn about 2.3× a sound plan in the Commons, Shades, Stoneback, Scholarium or Outer Ward, at almost no risk. | High March: 150 buyers/day; Crown Ward: 260/day, contracts at 95% of list | `neighborhoods.ts` |
| 5 | **How dangerous is the Commons?** Over 52 weeks a busy, law-abiding Commons cart that refuses protection draws the Ninepenny Crew to a warning in ~93% of runs (one slow arc with ~12 weeks of warning signs; a guard prevents it). Too often? | crime 0.55, criminal attention tolerance 25, precautions −25% | `neighborhoods.ts`, `dynamics.criminal`, extortion thread in `events/threads.ts` |
| 6 | **Licensing timeline.** When was the filing? Canon says approval in about six months. | Ruling on day 168 after the sim start (start of week 25) | `licensingDecisionAfterDays` |
| 7 | **Wages and staff.** Is 2 sp/day right for a seller? How honest is the typical hire? | vendor 20 cp, runner 18 cp, guard 40 cp; skimming starts below honesty 50 | `marketWageCpPerDay`, `staff.ts`, `dynamics.skimming` |
| 8 | **Guild dues and permits.** | Associate 2 gp + 1 gp/wk; member 10 gp + 2.5 gp/wk; permits 0.5–1.5 gp/wk | `assumptions.guild`, neighborhood fees |
| 9 | **Kitchen rent share.** Should the business pay part of the canon 14 gp rent? | 25% (3.5 gp/wk) | `kitchenRentShareCpPerWeek` |
| 10 | **Calendar.** Adopt or change the proposed 13×28+1 calendar, month and weekday names, festivals, and the current date. | Start 1 Harvest 940 CY (placeholder) | `world/calendar.ts` |
| 11 | **Pace of events.** Is about one decision every 4–6 in-game weeks right for a well-run business? | ≥ 21 days between opportunity decisions; quiet spell 14 days after major events | `world/pacing.ts`, hazard rates in `world/events/` |
| 12 | **The business account.** How much should the party keep in the business, and how much credit do suppliers give? | Floor = 1 week of running costs; credit = about 1 week of ingredients at +10% | `assumptions.account` |
| 13 | **Districts.** Do the characters above match the city? Should the Shades and the Outer Ward be more or less dangerous? Should the Scholarium's recess be in summer? What is Guildstrand like? | See "The districts" | `neighborhoods.ts`, `actors.ts` |
| 14 | **Starting small.** Is one cart, one seller and 500 pies a week the right start? Should it earn more than ~2–4 gp a week (lower rent share, busier cart)? What unlocks next, and when? | See "Starting small" | `src/world/stages.ts`, `kitchenRentShareCpPerWeek` |

## Starting small (business size)

The DM's guard rail (22 Nov 2026): the party **starts with one district, one cart and one hire**, and the business grows only when the DM unlocks a bigger size. The plan's "Business size" sets the limits, and the server rejects anything bigger, including a mid-season revision. Only the DM can change the size.

| Size | Limits |
|---|---|
| **Starting out** | One street cart in one district; one hire (a seller); up to **500 pies a week** (provisional); constructs at a steady pace; no extra festival-day baking. |
| **Unrestricted (sandbox)** | No limits. For strategy studies only. |

The next sizes (a stall, a second seller, delivery, more output, pushing the constructs) are for the table to decide as the business grows.

**What a starting cart earns** (Commons, honest pies at 5 cp, 450 a week, 20 seeds): about **49 gp in the first 26 weeks and 131 gp in 52**, rising from about break-even to roughly **4 gp a week** as people learn about the cart, and it never loses money over a year. One seller sells about 400–450 pies a week. The kitchen rent share (3.5 gp a week) is the largest cost. A cart is hopeless in High March or the Crown Ward (few buyers, and they don't buy from carts), and the Shades is thin at 4 cp. If a starting cart should earn more, the knobs are the rent share (`kitchenRentShareCpPerWeek`) and the cart's share of district traffic (`channels.cart.trafficShare`).

**Short reports.** Each weekly report keeps its summary plus the three notes that matter most (events and threats first, weather last). Players see only that; the DM can switch to every note with its explanation. A starting cart averages about 3 lines a week, down from about 9 (lines plus DM explanations).

## The districts

Eight districts are modelled. The names are canon. Each one's character comes from the DM's notes and is the first line of its description. Every number is provisional, with relative crowd sizes, competition and crime informed by the City Index census (see `docs/CITY_INDEX.md`). Guildstrand, where the party lives, is not modelled yet.

| District | Character (DM) | What the simulation does with it |
|---|---|---|
| **The Commons** | Working district | Big, hungry crowds at 5 cp; many cheap rivals; lax enforcement; a protection crew that notices busy carts. |
| **The Grand Market** | Commercial heart | The largest crowds and market days; strong guild; active enforcement; opportunistic thieves. |
| **High March** | Wealthier customers: premium pies, higher prices, deliveries | Few buyers (150 a day) who pay for quality and prefer delivery; little crime; notable patrons talk (×1.5). |
| **The Shades** | Price-sensitive customers and less formal commerce: low-cost pies, trusted local vendors | Fair price 4 cp and very price-sensitive. **Strangers are ignored at first** (a lower floor on awareness), then **regulars count for 1.8×** the usual. Permits are barely enforced and fees are tiny. Crime is high: the Lowlamp Crew asks every busy seller for a cut. |
| **Stoneback** | Craftspeople and industrial workers: filling pies, bulk orders | Value matters more than quality. **Restday is dead** (×0.45). **Workshops take standing orders** (14 potential accounts) and **foremen order in bulk** (2.2× as often, 1.4× the size). Few rivals. |
| **The Scholarium** | Students, scholars and staff: inexpensive lunches, repeat customers | Price-sensitive, with charity kitchens competing. **Regulars count for 2×.** **Summer recess** cuts demand to 60%. Quiet on Restday; little crime. |
| **The Outer Ward** | Mixed residential demand: neighborhood vendors and delivery routes | **Delivery rounds suit it** (delivery fit 1.2), and people are home on Restday (×1.15). Regulars count for 1.5×. Middling crime: delivery rounds stay below the Gatehouse Gang's notice in most years; a cart draws more attention. |
| **The Crown Ward** | Officials, wealthy households and institutions: catering, luxury orders and contracts | Fair price 12 cp at fine quality. **Catering orders** come 1.8× as often and pay 1.2×. **Supply contracts pay 95% of list price, but ministries contract only with fully compliant suppliers** (others reach a quarter of the accounts). Strict enforcement (0.9), high fees, offices closed on Restday, Council Day ×1.6, notable patrons ×1.6. Street crime is rare. |

Each district has a proposed local rival and crew (stand-ins until the DM picks real ones from the City Index or the small-factions proposal).

## The business account

The pie money is kept apart from the party's own purses, in a place the party chooses (a label; the default is a strongbox, location to be decided). Only the DM records withdrawals and deposits, and the server enforces that. The account shows a dated statement, the balance, an **operating floor** (provisional: one week of running costs), and what is **safe to withdraw** above it.

When the account runs dry there are no loans; the remedy is a deposit the DM records. Short of that:

- **Overdrawn:** suppliers sell on credit at +10%, wages go out late (each employee loses morale every week), and players get a "bills going unpaid" notice.
- **Beyond the suppliers' credit** (provisional: about a week of ingredients): deliveries stop, and the constructs stand idle until a deposit arrives. This is a major event with a session hook.
- **Unattended sandbox runs** assume the party covers the debts at week's end once suppliers have cut the business off, recorded as a deposit by "sandbox assumption". Set "If the money runs out" to "Nobody does" for real play.
- **Payouts:** the plan's "Paying the party" setting is either an automatic share above the reserve (handy for sandbox comparisons) or "only when the DM records a withdrawal" (real play).

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
| Cheap pies in the Shades | 404 / 431 / 464 gp | 0% | 8.3 | 12.9 | 1.5 | Negotiates with the Lowlamp Crew; refusing brings a warning every year |
| Stoneback yards and workshops | 500 / 529 / 550 gp | 0% | 8.4 | 12.3 | 1.5 | Slow start while standing orders sign on, then ~13 gp/week |
| Scholarium lunch stall | 502 / 536 / 559 gp | 0% | 7.8 | 11.1 | 1.6 | Lowest waste; the summer recess shows in the last weeks |
| Outer Ward delivery rounds | 514 / 544 / 568 gp | 0% | 9.5 | 12.4 | 1.3 | |
| Crown Ward catering and contracts | 1141 / 1286 / 1401 gp | 0% | 8.1 | 12.0 | 1.6 | Rich and calm, if fully compliant |
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
- Guildstrand (the party's own district) is not modelled yet.
- When a showdown is flagged "settle at the table", the simulation freezes that situation and assumes nothing further; the DM records the outcome as an intervention.
- Major factions are named but not yet modelled as actors with goals; local proposed actors carry the conflicts.
- Weekday cycle runs through the intercalary day (design choice; easy to change).
