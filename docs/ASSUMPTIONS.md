# Provisional assumptions and calibration

Every number in `src/world/` is provisional. This page lists what to calibrate first, the current values, and what the simulation currently does with them. Run `npm run compare -- --runs 30 --weeks 26,52` after changing anything.

## First assumptions to calibrate (priority order)

| # | Question for the table | Current value | Where |
|---|---|---|---|
| 1 | **How much should a successful pie business earn?** The canon anchor is rent of 14 gp/week. At the DM's request (Nov 2026) the business can earn real money: a starting cart about 20 gp/week. | Starting cart ~22 gp/week; sound plans in the working districts ~35–55 gp/week; Grand Market, High March and Crown Ward ~110–125 gp/week | Demand (`baseDailyCustomers`, `referencePriceCp`) in `neighborhoods.ts`; ingredient costs in `assumptions.ts` |
| 2 | **Price of a meat pie** by district. | Fair price: Shades 8 cp; Commons, Stoneback, Scholarium, Outer Ward 10 cp (1 sp); Grand Market 12 cp; Crown Ward 24 cp; High March 32 cp (quality-adjusted ±30%/tier). Doubled in Nov 2026; still below a 5e "modest meal" (3 sp). | `referencePriceCp`, `fairPriceQualitySlope` |
| 3 | **Construct output.** How many pies can three constructs bake in a day, and how far can they be pushed? This caps every strategy, and most good plans hit it. | 70/day each → 210/day; pushed ×1.3 with strain, breakdowns and fire risk (proposed mechanic) | `constructs` in `assumptions.ts`, `events/risk.ts` |
| 4 | **Should the rich districts pay twice what the working districts do?** Luxury High March and Crown Ward catering each earn about twice a sound plan in the Commons, Stoneback, Scholarium or Outer Ward (three to four times the Shades), at almost no risk. | High March: 150 buyers/day; Crown Ward: 260/day, contracts at 95% of list | `neighborhoods.ts` |
| 5 | **How dangerous is the Commons?** Over 52 weeks a busy, law-abiding Commons cart that refuses protection draws the Ninepenny Crew to a warning in ~93% of runs (one slow arc with ~12 weeks of warning signs; a guard prevents it). Too often? | crime 0.55, criminal attention tolerance 25, precautions −25% | `neighborhoods.ts`, `dynamics.criminal`, extortion thread in `events/threads.ts` |
| 6 | **Licensing timeline.** When was the filing? Canon says approval in about six months. | Ruling on day 168 after the sim start (start of week 25) | `licensingDecisionAfterDays` |
| 7 | **Wages and staff.** Is 2 sp/day right for a seller? How honest is the typical hire? | vendor 20 cp, runner 18 cp, guard 40 cp; skimming starts below honesty 50 | `marketWageCpPerDay`, `staff.ts`, `dynamics.skimming` |
| 8 | **Guild dues and permits.** | Associate 2 gp + 1 gp/wk; member 10 gp + 2.5 gp/wk; permits 0.5–1.5 gp/wk | `assumptions.guild`, neighborhood fees |
| 9 | **Kitchen rent share.** Should the business pay part of the canon 14 gp rent? | 25% (3.5 gp/wk) | `kitchenRentShareCpPerWeek` |
| 10 | **Calendar.** The Calendar of Arentor is canon (adopted 23 Nov 2026), and the campaign date is 12 Rainmoot 940 CY (DM ruling). Still open: how much each observance should change trade. | Campaigns start 12 Rainmoot 940; observance effects modest and mostly local | `world/calendar.ts` |
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

- one bit of color, rotating: the local rival's own ad, an upcoming festival (then not repeated under "Coming up"), a lost-and-found oddity, or an adventuring notice. The last two are story hooks for the DM; they don't change the simulation.

They remind the party of their options without telling them when to act. Buying is a conversation at the table: the DM records the cost as a withdrawal and changes the plan (and the business size, if it needs a bigger one). Set-up prices quoted are provisional: cart 45 gp, stall 60 gp plus the district's weekly fee, baskets 25 gp (`GROWTH_PRICES_CP`).

## Starting small (business size)

The DM's guard rail (22 Nov 2026): the party **starts with one district, one cart and one hire**, and the business grows only when the DM unlocks a bigger size. The plan's "Business size" sets the limits, and the server rejects anything bigger, including a mid-season revision. Only the DM can change the size.

| Size | Limits |
|---|---|
| **Starting out** | One street cart in one district; one hire (a seller); up to **500 pies a week** (provisional); constructs at a steady pace; no extra festival-day baking. |
| **Unrestricted (sandbox)** | No limits. For strategy studies only. |

The next sizes (a stall, a second seller, delivery, more output, pushing the constructs) are for the table to decide as the business grows. For now, to let the party buy a second cart, switch the size to Unrestricted and hold the line yourself. A second outlet of the same kind in the same district reaches half as many new customers as the first (`demand.extraOutletReach`, compounding), so a second cart adds customers but can also flop.

**What a starting cart earns** (Commons, honest pies at 10 cp, 450 a week, 30 seeds): about **1,140 gp in its first year**, about **22 gp a week** on average. Starting in spring, it makes about 14 gp a week through Blossom and Highsun (warm weather, nobody knows the cart yet) and climbs to about 25 gp a week by autumn and winter, when hot pies sell themselves. It never loses money over a year. One seller sells about 400–450 pies a week. A cart is hopeless in High March or the Crown Ward (few buyers, and they don't buy from carts), and the Shades is thinner at 8 cp.

**Short reports.** Each weekly report keeps its summary plus the three notes that matter most (events and threats first, weather last). Players see only that; the DM can switch to every note with its explanation. A starting cart averages about 3 lines a week, down from about 9 (lines plus DM explanations).

## Calendar and observances (canon)

The Calendar of Arentor is canon, adopted from the DM's calendar document on 23 Nov 2026:
- 13 months of 28 days, then Council Day between years, outside the week;
- weeks run Firstday to Restday, with Marketday as market day and Restday as the usual day off;
- CY is counted from the Charter of the Five Seats.

The dates and observances are canon. How much each one changes trade is provisional and deliberately modest, as the document asks:

| Citywide | Date | Effect on trade (provisional) |
|---|---|---|
| First Light (Lathander) | 1–3 Seedtide | Commons ×1.25, elsewhere ×1.1 |
| Seedtide Fair (Chauntea, growers) | 7 Seedtide | Grand Market ×1.4, Outer Ward ×1.2 |
| Midsummer Revel | 14–15 Midsummer | Commons ×1.5, elsewhere ×1.3 |
| Golden Exchange (Waukeen, the Guild) | 14–16 Goldenreach | Grand Market ×1.4; elsewhere ×0.95, as the crowds go to the market |
| Harvest Fair | 21–24 Harvest | Grand Market ×1.6, Commons ×1.3, elsewhere ×1.2 |
| Lantern Night | 14 Leaffall | Commons ×1.45, Grand Market ×1.3 |
| Longnight Vigil | 28 Longnight | ×1.1 (ordinary shops may close; vigil-goers want something hot) |
| Council Day | between years | Crown Ward ×1.6, Grand Market ×1.5, elsewhere ×1.25 |

There are also thirteen district and smaller-church observances, each touching only its own district by ×1.1 to ×1.25. Examples: the Festival of the Rose in High March, Wonderwright's Day in Stoneback, the Open Book in the Scholarium, and the Duskmarket in the Shades. The Ledger Closing in Guildstrand has no effect, since Guildstrand isn't modelled. Prime-pitch offers only come for festivals that lift the business's own district by at least 25%.

The seven public churches (Lathander, Waukeen, Tyr, Sune, Chauntea, Gond, Oghma) are recorded as light factions: name, standing, district, observances and an institutional link (a pattern, not an alliance). Dawnfire worship is underground, with no public holiday.

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

Each district has a proposed local rival (a stand-in). Its crew comes from the DM's pool of fifteen small-time criminal enterprises (Factions document, SC-01 to SC-15). Where a district has several candidates (the Commons, the Grand Market, the Shades, Stoneback, the Scholarium), each campaign's luck draws one, and that name stays for the whole campaign. Crews stay minor: petty protection, theft and harassment. They never escalate to the Compact or the Deep Ledger on their own.

**Moving to another district** (provisional, `assumptions.move`): name recognition drops to 15% (a few people have heard of us), regulars stay behind, and reputation keeps half its distance from average (word of mouth). The old crew's and rival's interest reset, along with their feuds (the protection-racket and rival threads), and standing orders end. Guild standing, officials' attention, the kitchen and the money carry over. Choosing the district before day 1 is not a move.

## The business account

The pie money is kept apart from the party's own purses, in a place the party chooses (a label; the default is a strongbox, location to be decided). Only the DM records withdrawals and deposits, and the server enforces that. The account shows a dated statement, the balance, an **operating floor** (provisional: one week of running costs), and what is **safe to withdraw** above it.

When the account runs dry there are no loans; the remedy is a deposit the DM records. Short of that:

- **Overdrawn:** suppliers sell on credit at +10%, wages go out late (each employee loses morale every week), and players get a "bills going unpaid" notice.
- **The players are told exactly what it costs and what they need,** rounded up to whole gold:
  - the report spells out the surcharge paid ("suppliers charged us 1 gp 4 sp extra for buying on credit") and the late wages;
  - it says how much is owed, how much gets deliveries going again (with a margin for price swings), how much clears the debt, and how much also leaves a week's cushion.

  The Account tab shows the same figures for the DM. Paying is simply a deposit: the party refills the strongbox, and the manager pays the suppliers from it. There are no moneylenders, by the DM's choice.
- **Beyond the suppliers' credit** (provisional: about a week of ingredients): deliveries stop, and the constructs stand idle until a deposit arrives. This is a major event with a session hook.
- **Unattended sandbox runs** assume the party covers the debts at week's end once suppliers have cut the business off, recorded as a deposit by "sandbox assumption". Set "If the money runs out" to "Nobody does" for real play.
- **Payouts:** the plan's "Paying the party" setting is either an automatic share above the reserve (handy for sandbox comparisons) or "only when the DM records a withdrawal" (real play).

## Pacing (how often things happen)

Pacing is tuned per **in-game time**, never per session: you decide how far the clock runs each session, and the pacing follows. Targets per 52 weeks:

| | Sound plan | Risky plan |
|---|---|---|
| Player decisions | about one a month (12–16), the DM's target from Nov 2026 | 14–18 |
| Notable report items | 10–15 | 20–30 |
| Major events / adventure hooks | 2–4 | 6–10 |
| Longest quiet stretch | ≤ 6 weeks | 3–5 weeks |
| Same crisis repeating | rarely | at most 3 times |

Mechanisms (all in `src/world/pacing.ts` and the event library, all explainable):

- **Decision spacing**: opportunity/dilemma decisions are at least 21 days apart and never stack on an unanswered one.
- **Quiet spell**: for 14 days after a major event, adverse random events are damped ×0.4. This appears as a named driver.
- **Major spacing**: serious thread escalations wait at least 14 days after any major event.
- **Repeat cooldowns**: a thread stage can't re-fire for weeks after it last fired.
- **Threats resolve**: the second refused reprisal ends the extortion round. With real security the crew backs off; without it, they do damage first and it becomes a showdown to play at the table. A second sabotage burns a rival feud out for months.
- **Response windows**: most decisions can wait 1–14 days. Urgent ones (a crew at the door, an inspection ruling) stop the clock at once. Unanswered decisions fall back to the standing order at their deadline.
- **Monthly A-or-B choices** (`world/events/dilemmas.ts`): small decisions that move the dial, each with a safe and a risky option, and triggered by what really happened or by ordinary street life. They grow more likely over the six weeks after the party's last decision, so one arrives about monthly. Unanswered, the manager plays it safe.
  - *Selling out early*: bake a few more, or a lot more at a copper extra. At full capacity: keep the price, or charge two coppers more.
  - *Throwing pies away*: bake fewer, or pay a crier for a month (3 gp).
  - *A busier corner*: stay put, or take it for a month (more customers, and more attention from crews or inspectors).
  - *Cheap meat, no questions asked*: turn the drover away, or buy it (ingredients 30% cheaper for a month; a 35% chance someone falls ill).
  - *A new recipe*: stick to what works, or let the seller try it (55% a hit, 45% a flop).
  - *A street performer*: no thanks, or 2 gp for a week of crowds (20% chance of a mishap).
- **Good-news decisions**: raise requests, staff poaching, festival pitches, exclusive supplier deals, rival truces, charity requests, guild invitations, large orders and a caravan commission, so quiet, well-run businesses still have choices to make.

## Risk and reward

Bold choices should be **gambles**, with a wider spread of outcomes in both directions. Careful plans should be the narrow, dependable middle. Two kinds of risk behave differently, by design:

- **Bold** (pushing the constructs, showcasing the magical chefs, betting on volume) has real upside and real tails. **Pushing** gives +30% output, but builds construct strain (visible to players as "running hot" warnings) and rushes the baking (a small reputation drag). Strain causes breakdowns, and at high strain a major breakdown can become a **kitchen fire** (closed 4–7 weeks, 750–1,750 gp of repairs), which happens in roughly one pushed year in six. **Showcasing** draws crowds (occasional "spectacle" weeks, demand ×1.6) but also official attention while the license is pending.
- **Reckless** (skipping permits, guild and security, cheap unsupervised staff) saves a little and invites a lot. Consequences scale with the business: a crew's warning costs 25–45% of a week's takings, an unguarded showdown costs a full week's takings plus your best seller, and repeat inspection offences double and triple the penalties. A guild complaint can suspend a non-member's permit, and a strongbox robbery takes most of a week's takings. Reckless play generates stories rather than profit.

Measured over 52 weeks (40 seeds; 10th / 50th / 90th percentile of total profit):

| Plan | Bad year | Typical | Good year | Notes |
|---|---|---|---|---|
| Careful Grand Market expansion (steady) | 5,550 gp | 5,725 gp | 5,781 gp | narrow and dependable |
| Same plan, constructs **pushed** | 4,248 gp | 6,583 gp | 6,920 gp | fire in ~1 year in 6 |
| Low-price Commons, steady | 1,706 gp | 1,808 gp | 1,891 gp | |
| Low-price Commons, **pushed** | −55 gp | 1,648 gp | 1,935 gp | net loss in 13% of years |

## Observed behavior (30 seeds each, current calibration)

52 weeks from 12 Rainmoot 940 (10th / median / 90th percentile profit):

| Strategy | Profit p10 / median / p90 | P(net loss) | Decisions | Notable | Major | Notes |
|---|---|---|---|---|---|---|
| Starting out: one cart in the Commons | 1,074 / 1,139 / 1,197 gp | 0% | 14.2 | 16.9 | 1.3 | One cart, one seller, ≤ 500 pies a week |
| Conservative Commons cart | 2,620 / 2,792 / 2,950 gp | 0% | 15.1 | 16.7 | 3.3 | Meets the Ninepenny Crew in ~90% of years (one slow arc, ~12 weeks of warning) |
| Careful Grand Market expansion | 5,497 / 5,730 / 5,771 gp | 0% | 14.6 | 17.4 | 1.4 | Same ambition as "aggressive", done by the book |
| Aggressive Grand Market expansion | 2,925 / 4,730 / 5,161 gp | 0% (cash < 0 in every run) | 16.2 | 27.7 | 10.4 | Pushed, showcased, reckless: wide spread |
| Luxury High March | 6,258 / 6,643 / 6,833 gp | 0% | 12.7 | 18.1 | 1.5 | Thriving and calm |
| Low-price, high-volume (pushed) | −168 / 1,623 / 1,914 gp | 13% | 16.5 | 27.7 | 9.7 | Constant rival trouble while it keeps undercutting |
| Paying every fee & protection | 4,361 / 4,514 / 4,594 gp | 0% | 14.7 | 17.3 | 1.4 | Over-insured and under-producing |
| Resilient wholesale | 3,976 / 4,050 / 4,096 gp | 0% | 13.8 | 15.4 | 1.6 | |
| Festival-oriented | 2,563 / 2,859 / 2,990 gp | 0% | 14.1 | 16.3 | 1.4 | |
| Cheap pies in the Shades | 1,748 / 1,811 / 1,925 gp | 0% | 14.1 | 18.3 | 1.5 | Negotiates with the Lowlamp Crew; refusing brings a warning every year |
| Stoneback yards and workshops | 2,563 / 2,722 / 2,930 gp | 0% | 13.9 | 16.6 | 1.5 | Slow start while standing orders sign on |
| Scholarium lunch stall | 2,465 / 2,703 / 2,792 gp | 0% | 13.8 | 16.7 | 1.4 | Lowest waste; the summer recess comes early in the year |
| Outer Ward delivery rounds | 2,719 / 2,884 / 2,946 gp | 0% | 14.6 | 17.2 | 1.8 | |
| Crown Ward catering and contracts | 5,544 / 5,922 / 6,430 gp | 0% | 12.5 | 16.1 | 1.5 | Rich and calm, if fully compliant |
| Careless Commons (control) | −527 / −471 / −430 gp | 100% | 13.4 | 36.0 | 14.3 | |
| Cheap pies in High March (control) | −772 / −731 / −710 gp | 100% | 13.3 | 35.9 | 24.4 | |

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
- Council Day sits outside the week (canon). The business trades on it, because it's a public gathering, so the week containing it has a bonus trading day and one extra day's batch, even for a starting cart.
