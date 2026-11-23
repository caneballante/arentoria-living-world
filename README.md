# Arentoria Living World

A persistent, simulation-driven companion to a tabletop D&D campaign set in Arentoria, capital of Arentor (12 Rainmoot 940 CY, spring). It models the city's calendar, weather, economy, factions and developing situations so that player decisions between sessions have economic, political and narrative consequences.

**Status: Phase 1 — working simulation prototype.** The first playable system is the party's meat-pie business, run by three magical chef constructs. Everything runs in a **sandbox**: results are provisional and never change campaign canon.

## Quick start

Requires [Node.js](https://nodejs.org) 22.12 or newer.

**Easiest:** double-click **`Launch Arentoria.cmd`** (Windows) or **`Launch Arentoria.command`** (Mac). It installs dependencies on the first run, starts the app on a free port and opens your browser. Close the window (or press Ctrl+C) to stop.

From a terminal:

```bash
npm run launch               # same as the double-click launcher
npm run launch -- --prod     # production build (snappier pages)
```

A 20-minute playtest checklist is in **[docs/TEST_PLAN.md](docs/TEST_PLAN.md)**.

### Running the real campaign

Open **Campaign** in the top bar. There are two campaigns side by side:

- **The party's campaign** is the real one. Start it once with the *Starting out* plan in the district the players chose. The price fills in with the going rate there, and you're warned where a cart alone won't work. Then, between sessions: move the clock, look over what happened (the DM view shows everything), record what the players decided (answers, new orders, money taken out or put in), and **Publish** a report. Publishing locks that stretch in: later runs continue from it, so it never changes, even if the simulation's numbers are recalibrated later. Each report opens as a printable page, like a small newsletter. It starts with a season guide (all 13 months and Council Day by season, with the current month marked and a line on what it's like), then a letter from the manager, questions with tick boxes, the strongbox, week by week, a few **notices** (classified ads for real options: a second cart, a stall, delivery, another district, people looking for work, services), and how the business is run in a few sentences.
- **The test campaign** works exactly the same way, and you can restart it whenever you like. It never touches the real one.

The district can change later from **Orders**. That's a real move: nobody in the new district knows the business yet, regulars and standing orders stay behind, the old crew and rival are left behind, and about half the reputation travels by word of mouth. The move is listed in the audit trail and reported to the players that week.

Campaigns are saved on your computer in the project's `campaigns/` folder, which is kept out of git. Set `ARENTORIA_CAMPAIGN_DIR` to keep them somewhere else. A backup is written to `campaigns/backups/` before every publish, undo and restart. Back the folder up like any other important file. The real campaign can be started over only until its first report is published; after that you can **undo the latest report** if the players haven't seen it yet.

### The sandbox

In the **Sandbox** (for experiments and strategy studies):

1. Pick a starting scenario (or build a plan) in the left panel. It covers all twelve business decisions plus standing orders. The default, **Starting out**, is where the party begins: one district, one cart, one hire and up to 500 pies a week. The DM unlocks bigger sizes as the business grows ("Business size" at the top of the plan). The other scenarios are unrestricted strategy studies.
2. Move the **campaign clock**: **+1 day**, **+1 week** (a typical session), **+4 weeks**, or **Until something needs the party** (downtime: it runs up to 8 weeks and stops when a decision arises or something major happens). **Run a whole season** plays 13–52 weeks at once. New campaigns start on the campaign date, 12 Rainmoot 940 CY.
3. Read the "Since last time" summary and the reports. Reports are short: each week's summary plus the three notes that matter most. As DM, switch to **Every note + DM explanations** to see everything and why. **DM view** shows the hidden state and why each value changed; **Players** shows only what the party would learn.
4. Answer decisions now, or before their deadline. Urgent ones stop the clock; unanswered ones fall back to the standing orders.
5. Change the plan mid-season and click **Apply from day N** to continue under the new plan. Or restart the season and compare it with the previous run.
6. Track the money on the **Account** tab. The business money is kept apart from the party's own purses (where it's kept is the party's choice). The DM records withdrawals and deposits; the tab shows the balance, the operating floor, what's safe to withdraw, and a dated statement.
7. Use **Compare strategies** to run every scenario (and your own plan) over many seeds, including how often each produces decisions and crises.

## Commands

| Command | What it does |
|---|---|
| `npm run launch` | Install if needed, start the app, open the browser (`-- --prod`, `-- --no-open`, `-- --port 4000`) |
| `npm run dev` | Web app dev server only (sandbox, strategy comparison, canon & assumptions register) |
| `npm test` | All automated tests (Vitest) |
| `npm run typecheck` | TypeScript, strict |
| `npm run build` | Production build (Vercel-compatible) |
| `npm run sim -- --scenario commons-compliant --seed autumn-940 --weeks 26 --view dm` | One season in the terminal: weekly table, events, threads, "why" explanation, audit trail, reports |
| `npm run sim -- --list` | List the strategy scenarios |
| `npm run sim -- --plan my-plan.json --view player` | Run a plan exported from the web UI ("Export JSON") |
| `npm run compare -- --runs 30 --weeks 26,52` | Seeded batch comparison of all strategies (profit ranges, losses, escalation, end states, paired win rates) |

## Repository layout

```
src/engine/        Pure simulation engine: no React, no I/O, no world content.
  rng.ts             seeded, splittable random streams (cyrb128 + sfc32)
  calendar.ts        generic calendar (dates, weekdays, seasons, festivals)
  weather.ts         persistent weather + seasonal ingredient prices
  plan.ts            business plan schema (zod)
  economy.ts         demand, production, sales, costs
  dynamics.ts        weekly stock-and-flow updates for hidden state, with named drivers
  effects.ts         the effect vocabulary shared by events, decisions and DM interventions
  simulate.ts        day/week runner, threads, events, pauses, decisions, interventions, snapshots
src/world/         Arentoria content: canon facts, proposed worldbuilding, provisional numbers
  canon.ts           canon register (from the campaign brief)
  calendar.ts        PROPOSED 13×28+1 calendar and festivals
  neighborhoods.ts   eight districts (Commons to Crown Ward) + sales channels (numbers provisional)
  assumptions.ts     every economic / behavioral constant (provisional, calibratable)
  actors.ts          canon factions + proposed rivals, trade groups, crews
  staff.ts           proposed hiring pool (hidden traits)
  events/            conditional events, threads (progress clocks), scheduled events
  scenarios.ts       strategy test cases
src/campaign/      The real and test campaigns: draft, publish, undo (pure functions over a campaign file)
src/narrative/     Weekly reports derived from simulated conditions (each line has a DM-only basis)
src/views/         Player and DM projections — the only shapes that leave the server
src/analysis/      Seeded batch runs, metrics, paired comparisons
src/persistence/   Campaign files on the DM's machine (campaigns/), plus the repository boundary
src/server/        Public catalog, role resolution
src/app/, src/ui/  Next.js App Router pages, API routes and client components
scripts/           CLI runners
tests/             Vitest suites
db/                Draft Phase 2 SQL schema (not applied)
docs/              Architecture, roadmap, assumptions, related projects
```

## Canon, proposals and simulation

Every world item carries provenance: **canon** (from the campaign), **proposed** (drafted worldbuilding), **provisional** (a tunable number) or **simulated** (engine output). The Calendar of Arentor and its observances, the major factions and the seven public churches are *canon*: the DM adopted them from the campaign documents in Nov 2026. The fifteen small-time crews come from the DM's pool, with names proposed for approval. Rival pie sellers, the Fellowship, the licensing office and all staff candidates are *proposed*. All numbers are *provisional*. Simulated events are never promoted to canon automatically. The **Canon & assumptions** page in the app lists everything with its label.

## Key documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture, determinism, pauses and replay, permissions, the intervention layer
- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md): what to calibrate first, with current values and observed outcomes
- [docs/ROADMAP.md](docs/ROADMAP.md): phases 1–5 and next steps
- [docs/RELATED_PROJECTS.md](docs/RELATED_PROJECTS.md): what was reused from `systemic-risk-model` and `puget-sound-evidence-explorer`

## Deployment

The app is a standard Next.js project and deploys to Vercel as-is (API routes run as serverless functions). Nothing has been deployed. Phase 1 has no accounts. If the environment variable `ARENTORIA_DM_TOKEN` is set, only requests with a matching `x-dm-token` header receive the DM view; everyone else gets the player view.
