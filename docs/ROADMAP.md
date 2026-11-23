# Roadmap

## Phase 1: working simulation prototype (this delivery)

Done:

- Proposed calendar (13×28 + Council Day), seasons, weekdays, market and rest days, festivals.
- Persistent weather with temporal correlation, and seasonal ingredient and fuel prices.
- Eight modelled neighborhoods (Commons, Grand Market, High March, the Shades, Stoneback, the Scholarium, the Outer Ward, the Crown Ward), each with its own character, and four sales channels. Districts can weight regulars, ignore strangers, have seasons, place bulk or catering orders, and set contract terms. Only Guildstrand remains unmodelled.
- A business plan with all twelve decisions plus standing orders (zod-validated).
- Daily production and sales, weekly accounting, cash, owner draws and reinvestment.
- Hidden state as stocks and flows with named drivers; derived resilience and vulnerability.
- Nineteen conditional and opportunity events, four multi-stage threads and three scheduled events.
- Pauses mid-week, decisions (player and DM), "flag for session", deterministic replay, snapshots.
- An intervention commit point with an audit trail; player and DM projections; weekly narrative reports.
- Seeded batch comparison across nine strategies at 26/52 weeks; CLI and web UI.
- Campaign-clock controls (day/week/month/"until something needs the party"), response windows on decisions, plan revisions applied mid-season, "since last time" digests.
- Pacing tuned per in-game time: opportunity and dilemma decisions, decision spacing, quiet spells after major events, threats that resolve instead of looping, a pacing table in strategy comparison.
- Risk and reward: a "pushed" construct workload (more output, strain, breakdowns, fire risk), showcase spectacles, strongbox robberies, consequences scaled to business size, escalating penalties for repeat offences, and a "careful expansion" scenario for like-for-like comparison.
- A business account kept apart from the party's purses: dated statement, operating floor, safe-to-withdraw, DM-only withdrawals and deposits (server-enforced), real consequences when it runs dry, and an optional automatic payout for sandbox runs.
- Business sizes as the DM's guard rails: the party starts with one district, one cart, one hire and up to 500 pies a week, and the DM unlocks more. Short weekly reports (summary plus the three notes that matter most), with every note available to the DM.
- Repriced for fun (Nov 2026): local prices doubled so a starting cart earns about 20 gp a week and established businesses 50–110 gp a week; repair costs raised so risk still bites.
- The DM's canon calendar (Council Day outside the week; eight citywide and thirteen district or church observances with modest local effects), the major factions, the seven public churches, and the fifteen small-time crews as a pool each campaign draws its district crews from.
- One-step launcher and a playtest plan (`docs/TEST_PLAN.md`).
- 153 automated tests.

Next small steps (before Phase 2):

- Calibrate with the DM using the questions in `docs/ASSUMPTIONS.md`, including pacing.
- Decide whether reckless play (skipping permits, guild and security) should ever pay. Options include crew "favors" or a grey market for cheap ingredients (see ASSUMPTIONS, "Risk and reward").
- Add a one-factor sensitivity view ("what if only the price changed?") to the compare page.

## Phase 2: world state and interventions

The tool runs on the DM's machine and publishes to DungeonShare, so it doesn't need to be hosted. Campaign storage is local files instead of Supabase.

- Done: the players choose the starting district (with the going rate and a warning where a cart won't work), and changing district later is a real move with costs.
- Done: **the real campaign and a test campaign**, saved locally. The DM moves the clock, reviews, records the party's answers, orders and money, and publishes numbered reports. Published stretches are locked (snapshots), drafts can be rewound, and the latest report can be undone. Reports are printable and available as player-safe JSON.
- Done (Living World side): **Send to DungeonShare** for published reports of the real campaign, with send again, take down, and take-down on undo. The DungeonShare side (a **Pie Shop** tab with Overview, Latest update and Our choices, and a `POST/DELETE /api/pie-shop` endpoint with its own key) is built and needs merging and deploying there.
- The simulation stays as it is: no new mechanics. Assessments and clues come from asking Claude at the table, outside the sim's accounting.
- Next: a **manager's voice** for the report letter, with "because you…" lines tying results to the party's choices.
- **Proposal → adjudication → effects** workflow for freeform actions. The DM gets a suggested interpretation (possible checks, costs, affected variables, candidate effects) and approves an edited effect list.
- DM overrides: edit any hidden variable, condition or thread through `applyIntervention`.
- **Factions as actors**: goals, resources, and clocks for the Merchants' Guild, Cloverpot Compact, Stonehome/Deep Ledger, Blanders School and the Council, once the campaign documents describe them. Local threads can escalate into faction clocks only through explicit, explainable links.
- **NPC relationships**: a small relationship graph (trust, debt, grudges) for staff, rivals and patrons.
- Scenario branches ("what if we join the guild?") saved separately from canon.

## Phase 3: DM control room

- Dashboard of the current canonical state, developing threads, upcoming scheduled events and deadlines.
- Review queue: generated events can be accepted, edited, suppressed or flagged for the table before a week is published.
- Scenario comparison against the canonical state; replay from any checkpoint.
- Publish step: the DM approves a week, and the player-facing reports are written.

## Phase 4: online player experience

- Supabase Auth; campaign membership; RLS so players can never read snapshots or audit records.
- Player home: published weekly reports, business plan, staff messages, offers, warnings, open decisions and deadlines.
- Proposals and voting with configurable rules per decision (majority, unanimity, owner decides, DM decides) and deadlines.
- Freeform action submission feeding the Phase 2 adjudication queue.
- Notifications (email/web push) for deadlines and published reports.

## Phase 5: campaign integration

- Explicit, reviewed import of approved session outcomes (e.g. from Dungeon Tracker/Dungeon Share) as interventions: parse, show a diff of proposed effects, have the DM approve, then commit with an audit record.
- Export of canon state and reports for session prep.

## Design guard rails (all phases)

- The engine stays pure and deterministic. AI suggestions never write state; only approved effects do.
- Simulated output is never canon without an explicit, recorded DM action.
- Prefer meaningful choices over bookkeeping; quiet profitable weeks are fine.
