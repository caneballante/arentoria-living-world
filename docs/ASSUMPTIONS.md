# Provisional assumptions and calibration

Every number in `src/world/` is provisional. This page lists what to calibrate first, the current values, and what the simulation currently does with them. Run `npm run compare -- --runs 30 --weeks 26,52` after changing anything.

## First assumptions to calibrate (priority order)

| # | Question for the table | Current value | Where |
|---|---|---|---|
| 1 | **How much should a successful pie business earn?** The canon anchor is rent of 14 gp/week. At the DM's request (Nov 2026) the business can earn real money: a starting cart about 20 gp/week. | Starting cart ~21 gp/week; sound plans in the working districts ~35–55 gp/week; Grand Market, High March and Crown Ward ~110 gp/week | Demand (`baseDailyCustomers`, `referencePriceCp`) in `neighborhoods.ts`; ingredient costs in `assumptions.ts` |
| 2 | **Price of a meat pie** by district. | Fair price: Shades 8 cp; Commons, Stoneback, Scholarium, Outer Ward 10 cp (1 sp); Grand Market 12 cp; Crown Ward 24 cp; High March 32 cp (quality-adjusted ±30%/tier). Doubled in Nov 2026; still below a 5e "modest meal" (3 sp). | `referencePriceCp`, `fairPriceQualitySlope` |
| 3 | **Construct output.** How many pies can three constructs bake in a day, and how far can they be pushed? This caps every strategy, and most good plans hit it. | 70/day each → 210/day; pushed ×1.3 with strain, breakdowns and fire risk (proposed mechanic) | `constructs` in `assumptions.ts`, `events/risk.ts` |
| 4 | **Should the rich districts pay twice what the working districts do?** Luxury High March and Crown Ward catering each earn about 2.1× a sound plan in the Commons, Stoneback, Scholarium or Outer Ward (3× the Shades), at almost no risk. | High March: 150 buyers/day; Crown Ward: 260/day, contracts at 95% of list | `neighborhoods.ts` |
| 5 | **How dangerous is the Commons?** Over 52 weeks a busy, law-abiding Commons cart that refuses protection draws the Ninepenny Crew to a warning in ~93% of runs (one slow arc with ~12 weeks of warning signs; a guard prevents it). Too often? | crime 0.55, criminal attention tolerance 25, precautions −25% | `neighborhoods.ts`, `dynamics.criminal`, extortion thread in `events/threads.ts` |
| 6 | **Licensing timeline.** When was the filing? Canon says approval in about six months. | Ruling on day 168 after the sim start (start of week 25) | `licensingDecisionAfterDays` |
| 7 | **Wages and staff.** Is 2 sp/day right for a seller? How honest is the typical hire? | vendor 20 cp, runner 18 cp, guard 40 cp; skimming starts below honesty 50 | `marketWageCpPerDay`, `staff.ts`, `dynamics.skimming` |
| 8 | **Guild dues and permits.** | Associate 2 gp + 1 gp/wk; member 10 gp + 2.5 gp/wk; permits 0.5–1.5 gp/wk | `assumptions.guild`, neighborhood fees |
| 9 | **Kitchen rent share.** Should the business pay part of the canon 14 gp rent? | 25% (3.5 gp/wk) | `kitchenRentShareCpPerWeek` |
| 10 | **Calendar.** Adopt or change the proposed 13×28+1 calendar, month and weekday names, festivals, and the current date. | Start 1 Harvest 940 CY (placeholder) | `world/calendar.ts` |
| 11 | **Pace of events.** Is about one decision every 4–6 in-game weeks right for a well-run business? | ≥ 21 days between opportunity decisions; quiet spell 14 days after major events | `world/pacing.ts`, hazard rates in `world/events/` |
| 12 | **The business account.** How much should the party keep in the business, and how much credit do suppliers give? | Floor = 1 week of running costs; credit = about 1 week of ingredients at +10% | `assumptions.account` |
| 13 | **Districts.** Do the characters above match the city? Should the Shades and the Outer Ward be more or less dangerous? Should the Scholarium's recess be in summer? What is Guildstrand like? | See "The districts" | `neighborhoods.ts`, `actors.ts` |
| 14 | **Starting small.** Is one cart, one seller and 500 pies a week the right start? Is ~20 gp a week right for it? What unlocks next, and when? | See "Starting small" | `src/world/stages.ts`, `kitchenRentShareCpPerWeek` |

## Money scale (repriced Nov 2026)

At the DM's request, the business can make real money: a starting cart earns about 20 gp a week, and everything else scales with it. The prices locals expect were **doubled** in every district (a Commons pie is now 1 sp), and the starting plans' prices with them. Costs did not change: canon rent, 5e wages, ingredients, fees. Margins were thin, so profits rose about five-fold.

Some fixed amounts now feel small next to the income. Repairs were raised five-fold so pushing the constructs stays a real gamble (a kitchen fire now costs 750–1,750 gp plus 4–7 weeks closed). Guild dues (1–2.5 gp/week), festival pitches (from 1 gp) and inspection fines are unchanged. Should they rise too? Most other consequences (thefts, protection money, vandalism, sabotage, robbery) already scale with takings.

With automatic payouts keeping only a small reserve, a rare artificer's repair (100–250 gp) can overdraw a steady business in about one run in 30. In real play, payouts are DM-only, so money builds up in the strongbox.

## Notices (classified ads in reports)

Each published report carries three or four notices (`src/world/notices.ts`, proposed flavor):
- one way to grow, rotating through those the business hasn't taken (a second cart "ready with staff", a stall, runners and baskets, an innkeeper wanting standing orders);
- one pitch for another district, a different one each report, quoting a typical pie's price there;
- one or two options that would change something for this business: a seller or runner looking for work (public blurb and asking wage), a bodyguard, a town crier, a second butcher, better cuts, the guild, the licensing office.

They remind the party of their options without telling them when to act. Buying is a conversation at the table: the DM records the cost as a withdrawal and changes the plan (and the business size, if it needs a bigger one). Set-up prices quoted are provisional: cart 45 gp, stall 60 gp plus the district's weekly fee, baskets 25 gp (`GROWTH_PRICES_CP`).

## Starting small (business size)

The DM's guard rail (22 Nov 2026): the party **starts with one district, one cart and one hire**, and the business grows only when the DM unlocks a bigger size. The plan's "Business size" sets the limits, and the server rejects anything bigger, including a mid-season revision. Only the DM can change the size.

| Size | Limits |
|---|---|
| **Starting out** | One street cart in one district; one hire (a seller); up to **500 pies a week** (provisional); constructs at a steady pace; no extra festival-day baking. |
| **Unrestricted (sandbox)** | No limits. For strategy studies only. |

The next sizes (a stall, a second seller, delivery, more output, pushing the constructs) are for the table to decide as the business grows.

**What a starting cart earns** (Commons, honest pies at 10 cp, 450 a week, 30 seeds): about **1,080 gp in its first year**, about **21 gp a week** on average, rising from about 8 gp in the first week to about 23 gp by the end of the year as people learn about the cart. It never loses money over a year. One seller sells about 400–450 pies a week. A cart is hopeless in High March or the Crown Ward (few buyers, and they don't buy from carts), and the Shades is thinner at 8 cp.

**Short reports.** Each weekly report keeps its summary plus the three notes that matter most (events and threats first, weather last). Players see only that; the DM can switch to every note with its explanation. A starting cart averages about 3 lines a week, down from about 9 (lines plus DM explanations).

## The districts

Eight districts are modelled. The names are canon. Each one's character comes from the DM's notes and is the first line of its description. Every number is provisional, with relative crowd sizes, competition and crime informed by the City Index census (see `docs/CITY_INDEX.md`). Guildstrand, where the party lives, is not modelled yet.

| District | Character (DM) | What the simulation does with it |
|---|---|---|
| **The Commons** | Working district | Big, hungry crowds at 10 cp; many cheap rivals; lax enforcement; a protection crew that notices busy carts. |
| **The Grand Market** | Commercial heart | The largest crowds and market days; strong guild; active enforcement; opportunistic thieves. |
| **High March** | Wealthier customers: premium pies, higher prices, deliveries | Few buyers (150 a day) who pay for quality and prefer delivery; little crime; notable patrons talk (×1.5). |
| **The Shades** | Price-sensitive customers and less formal commerce: low-cost pies, trusted local vendors | Fair price 8 cp and very price-sensitive. **Strangers are ignored at first** (a lower floor on awareness), then **regulars count for 1.8×** the usual. Permits are barely enforced and fees are tiny. Crime is high: the Lowlamp Crew asks every busy seller for a cut. |
| **Stoneback** | Craftspeople and industrial workers: filling pies, bulk orders | Value matters more than quality. **Restday is dead** (×0.45). **Workshops take standing orders** (14 potential accounts) and **foremen order in bulk** (2.2× as often, 1.4× the size). Few rivals. |
| **The Scholarium** | Students, scholars and staff: inexpensive lunches, repeat customers | Price-sensitive, with charity kitchens competing. **Regulars count for 2×.** **Summer recess** cuts demand to 60%. Quiet on Restday; little crime. |
| **The Outer Ward** | Mixed residential demand: neighborhood vendors and delivery routes | **Delivery rounds suit it** (delivery fit 1.2), and people are home on Restday (×1.15). Regulars count for 1.5×. Middling crime: delivery rounds stay below the Gatehouse Gang's notice in most years; a cart draws more attention. |
| **The Crown Ward** | Officials, wealthy households and institutions: catering, luxury orders and contracts | Fair price 24 cp at fine quality. **Catering orders** come 1.8× as often and pay 1.2×. **Supply contracts pay 95% of list price, but ministries contract only with fully compliant suppliers** (others reach a quarter of the accounts). Strict enforcement (0.9), high fees, offices closed on Restday, Council Day ×1.6, notable patrons ×1.6. Street crime is rare. |

Each district has a proposed local rival and crew (stand-ins until the DM picks real ones from the City Index or the small-factions proposal).

**Moving to another district** (provisional, `assumptions.move`): name recognition drops to 15% (a few people have heard of us), regulars stay behind, and reputation keeps half its distance from average (word of mouth). The old crew's and rival's interest reset, along with their feuds (the protection-racket and rival threads), and standing orders end. Guild standing, officials' attention, the kitchen and the money carry over. Choosing the district before day 1 is not a move.

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

- **Bold** (pushing the constructs, showcasing the magical chefs, betting on volume) has real upside and real tails. **Pushing** gives +30% output, but builds construct strain (visible to players as "running hot" warnings) and rushes the baking (a small reputation drag). Strain causes breakdowns, and at high strain a major breakdown can become a **kitchen fire** (closed 4–7 weeks, 750–1,750 gp of repairs), which happens in roughly one pushed year in six. **Showcasing** draws crowds (occasional "spectacle" weeks, demand ×1.6) but also official attention while the license is pending.
- **Reckless** (skipping permits, guild and security, cheap unsupervised staff) saves a little and invites a lot. Consequences scale with the business: a crew's warning costs 25–45% of a week's takings, an unguarded showdown costs a full week's takings plus your best seller, and repeat inspection offences double and triple the penalties. A guild complaint can suspend a non-member's permit, and a strongbox robbery takes most of a week's takings. Reckless play generates stories rather than profit.

Measured over 52 weeks (40 seeds; 10th / 50th / 90th percentile of total profit):

| Plan | Bad year | Typical | Good year | Notes |
|---|---|---|---|---|
| Careful Grand Market expansion (steady) | 5,580 gp | 5,724 gp | 5,767 gp | narrow and dependable |
| Same plan, constructs **pushed** | 4,406 gp | 6,583 gp | 6,905 gp | fire in ~1 year in 6 |
| Low-price Commons, steady | 2,117 gp | 2,209 gp | 2,299 gp | |
| Low-price Commons, **pushed** | 667 gp | 2,474 gp | 2,788 gp | net loss in 5% of years |

## Observed behavior (30 seeds each, current calibration)

52 weeks from 1 Harvest 940 (10th / median / 90th percentile profit):

| Strategy | Profit p10 / median / p90 | P(net loss) | Decisions | Notable | Major | Notes |
|---|---|---|---|---|---|---|
| Starting out: one cart in the Commons | 1,052 / 1,077 / 1,137 gp | 0% | 7.6 | 10.6 | 1.3 | One cart, one seller, ≤ 500 pies a week |
| Conservative Commons cart | 2,655 / 2,689 / 2,757 gp | 0% | 9.2 | 11.7 | 2.7 | Meets the Ninepenny Crew in ~90% of years (one slow arc, ~12 weeks of warning) |
| Careful Grand Market expansion | 5,646 / 5,708 / 5,765 gp | 0% | 8.8 | 11.9 | 1.5 | Same ambition as "aggressive", done by the book |
| Aggressive Grand Market expansion | 2,781 / 4,732 / 4,990 gp | 0% (cash < 0 in every run) | 10.7 | 22.7 | 10.7 | Pushed, showcased, reckless: wide spread |
| Luxury High March | 5,193 / 5,718 / 5,969 gp | 0% | 8.2 | 14.3 | 1.4 | Thriving and calm |
| Low-price, high-volume (pushed) | 767 / 2,423 / 2,773 gp | 0% | 13.1 | 24.6 | 10.5 | Constant rival trouble while it keeps undercutting |
| Paying every fee & protection | 3,947 / 4,076 / 4,113 gp | 0% | 9.2 | 12.0 | 1.4 | Over-insured and under-producing |
| Resilient wholesale | 3,972 / 4,023 / 4,077 gp | 0% | 9.0 | 10.9 | 1.5 | |
| Festival-oriented | 2,421 / 2,451 / 2,490 gp | 0% | 8.9 | 11.2 | 1.4 | |
| Cheap pies in the Shades | 1,740 / 1,817 / 1,879 gp | 0% | 8.4 | 13.0 | 1.5 | Negotiates with the Lowlamp Crew; refusing brings a warning every year |
| Stoneback yards and workshops | 2,722 / 2,783 / 2,832 gp | 0% | 8.4 | 12.3 | 1.5 | Slow start while standing orders sign on |
| Scholarium lunch stall | 2,419 / 2,529 / 2,576 gp | 0% | 7.8 | 11.1 | 1.6 | Lowest waste; the summer recess shows in the last weeks |
| Outer Ward delivery rounds | 2,567 / 2,705 / 2,762 gp | 0% | 9.7 | 12.6 | 1.3 | |
| Crown Ward catering and contracts | 5,595 / 5,908 / 6,095 gp | 0% | 8.1 | 12.0 | 1.6 | Rich and calm, if fully compliant |
| Careless Commons (control) | −802 / −747 / −715 gp | 100% | 4.5 | 25.9 | 19.6 | |
| Cheap pies in High March (control) | −869 / −858 / −847 gp | 100% | 2.9 | 25.1 | 25.5 | |

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
