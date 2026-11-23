# Architecture

## Recommendation: a TypeScript modular monolith

One Next.js application, one repository, one deployable. It has strict internal module boundaries and a pure simulation engine at its center.

- **Next.js (App Router) + React**: UI and thin API routes. Deploys to Vercel unchanged.
- **TypeScript everywhere**: one language for the engine, server and UI, so a plan typed in the browser is validated by the same zod schema the engine uses.
- **PostgreSQL via Supabase (Phase 2+)**: JSONB world snapshots, an append-only audit table, proposals and votes, and Row Level Security for DM and player separation. See `db/schema.draft.sql`.
- **No microservices, no queues, no realtime infrastructure yet.** A 52-week run takes about 10 ms, and a 9-strategy × 30-seed × 52-week comparison takes about 6 s, so everything runs synchronously inside a request.

## Layers and dependency rules

```
            ┌───────────────────────────── src/app, src/ui (Next.js, React) ─────────────────────────────┐
            │  pages · client components · API routes (/api/simulate, /api/compare)                        │
            └──────────────┬─────────────────────────────────────────────────────────────┬──────────────┘
                           │ (server only)                                               │ type-only imports
               ┌───────────▼───────────┐   ┌────────────────────┐   ┌──────────────────┐ │
               │ src/views              │   │ src/analysis        │   │ src/server        │◄┘
               │ player / DM projection │   │ batch, metrics      │   │ catalog, roles    │
               └───────────┬───────────┘   └─────────┬──────────┘   └────────┬─────────┘
                           │                         │                       │
               ┌───────────▼─────────────┐           │                       │
               │ src/narrative            │           │                       │
               │ reports from conditions  │           │                       │
               └───────────┬─────────────┘           │                       │
                           ▼                         ▼                       ▼
    ┌──────────────────────────────── src/world (content) ─────────────────────────────────┐
    │ canon register · proposed calendar · neighborhoods · assumptions · actors · events    │
    └──────────────────────────────────────────┬────────────────────────────────────────────┘
                                               ▼
    ┌──────────────────────────── src/engine (pure, generic) ──────────────────────────────┐
    │ rng · calendar · weather · plan schema · economy · dynamics · effects · simulate      │
    └───────────────────────────────────────────────────────────────────────────────────────┘
                 src/persistence (repository boundary) stores engine snapshots as JSON
```

`tests/boundaries.test.ts` enforces these rules:

- The engine imports only itself and zod: no React, Next, I/O or world content.
- World content imports only the engine.
- Narrative, analysis and views never import React or Next.
- Client components never import the engine, world, views, narrative or analysis. Hidden state can reach a browser only through a server-built view.

### Responsibilities (mapping to the brief)

| Brief | Where |
|---|---|
| World state | `WorldState` (engine/types.ts): plain JSON with calendar position, weather, markets, business, hidden variables, staff, threads, conditions, modifiers, scheduled events, pending decisions, events, audit history, player knowledge, week records |
| Simulation engine | `engine/simulate.ts` with `economy.ts`, `dynamics.ts` and `weather.ts`, all deterministic given state + plan + seed + resolutions |
| Intervention & adjudication | `applyIntervention()` and `resolveDecision()` in `engine/simulate.ts`, and the `Effect` vocabulary in `engine/types.ts`/`effects.ts` |
| Narrative | `narrative/weekly-report.ts`: text is derived from simulated conditions, and every line has a DM-only `basis` |
| Interfaces | `views/` (player and DM projections), API routes, UI |

## The simulation loop

Time advances one day at a time; each 7th day closes an accounting week.

1. Weather (AR(1) temperature anomaly + seasonal Markov precipitation) and ingredient prices (seasonal curves + AR(1) shocks) move.
2. Expired modifiers and conditions lapse; suspensions end.
3. Scheduled events due today fire (licensing ruling, delivery of a large order…).
4. **Threads** (progress clocks) accumulate pressure from conditions and may advance or recede a stage.
5. Morning events (absence, supply shortage, unexpected crowd).
6. **Operations**: production (capped by construct capacity and shortages), allocation to outlets, staff assignment, demand per outlet, sales, waste, skimming, daily costs.
7. Evening events (theft, food complaint).
8. **Week close**: fixed costs, hidden-state dynamics with drivers, staff morale/loyalty/skill, wholesale accounts, weekly events, owner draws, week record.

### Demand (per outlet per day)

```
potential customers × channel reach × channel fit × calendar (market/rest day, festival)
× weather foot traffic × hot-food appeal (cold helps) × exp(−sensitivity·(price/fair − 1))
× exp(weight·(quality − preferred)) × reputation × loyalty × awareness(visibility) × competition
× temporary modifiers × bounded noise (lognormal, clamped 0.7–1.4)
```

The exponential price curve gives each neighborhood a profit-maximizing price near *cost + reference/sensitivity*. That makes pricing a real decision rather than "always cheaper" or "always dearer".

### Hidden state as stocks and flows

Reputation, loyalty, visibility, scrutiny, guild relationship, criminal attention and rival hostility are 0–100 stocks. Each week they move by explicit, named inflows and outflows: drift, saturation and decay are balancing loops, while word of mouth (sales → visibility → sales) is a reinforcing loop. Every update records its drivers. The week inspector shows them, and an "events, decisions & limits" line accounts for shocks, so the explanation always reconciles with the change.

**Resilience** and **financial vulnerability** are derived from the plan and the books (suppliers, sheltered channels, cash runway, staff redundancy, compliance, security). They are not player-controlled scores.

### Events

- **Conditional events** have a hazard function returning a probability *and named drivers* computed from actual conditions, plus a resolution returning structured effects, a player text, a DM text, and optionally a decision.
- **Threads** model multi-stage situations: extortion, guild pressure, official scrutiny and inspection, rival response. Pressure accumulates daily from conditions; each stage gives a warning before things get serious; stages recede when conditions improve; a minimum dwell time prevents flip-flopping. Small proposed local actors (a Commons crew, a trade fellowship, a rival pie shop) carry these conflicts, so they need not escalate to the major canon factions.
- **Scheduled events** fire on a day, such as the construct licensing ruling (canon: about six months after filing) or a delivery the players agreed to.

## Determinism, snapshots and replay

- No shared RNG. Every draw comes from a stream derived from `hash(seed, context…)`, e.g. `("weather", day)` or `("event", eventId, day)`. Adding a new random draw never shifts any other subsystem.
- **Common random numbers**: two plans run with the same seed see identical weather and identical "dice" for each event check. Paired strategy comparisons isolate the effect of decisions.
- `WorldState` is plain JSON. `snapshot()` and `restore()` are JSON round trips, and resuming from any day reproduces the uninterrupted run exactly (tested, including a split mid-week).
- Decision ids are deterministic (`dec:<event>:<day>:<seq>`).

### Decisions, response windows and DM authority

Every decision has a **due day**. Urgent ones (a crew at the door, an inspection ruling, the licensing board) are due the day they arise. Others carry a **response window** (`respondWithinDays`, 1–14 days), so they can wait for the next session. At the end of its due day a decision is resolved, in every mode:

- **Answered** (possibly early): the supplied option takes effect at the due day, never earlier. That keeps replays deterministic no matter when someone clicked.
- **Unattended** (`pause: "never"`): the plan's standing orders (players) or sandbox assumptions (DM rulings) decide. Unanswered decisions are logged "(no answer by the deadline)".
- **Interactive**: the run stops (`status: "paused"`, `blocking` lists what is due), someone chooses, and the run resumes. With `decisions-and-major` it also stops on any major event, even mid-week.

The tests prove that an interactive run answering as the standing orders would is identical to the unattended run.

### The clock: advancing time between sessions

Pacing is per in-game time; the DM chooses how far the clock moves each session. The sandbox's clock bar maps to engine options:

- **+1 day / +1 week / +4 weeks**: run to a target day (`untilDay`, or `days` from the start).
- **Until something needs the party**: `stopWhenNeededAfterDay`. The run stops at the end of the first later day on which a decision arose or a major event happened (cap 8 weeks). Acknowledged events don't stop it again.
- **Plan revisions between sessions**: `interventions` scheduled for a day, applied at the start of that day and audited as `authority: "players"`. Applying a plan change mid-season equals stopping there and calling `applyIntervention` (tested).
- **"Since last time" digest** (`narrative/digest.ts`): summarizes any span of days (sales, money, trends, events, decisions, open deadlines), with a DM basis per line.

The web UI uses **stateless replay**: it keeps only `{starting plan, plan revisions by day, seed, resolutions, acknowledged events, target day}`, and the server re-simulates from the start each time (a year takes ~10 ms). Hidden state never lives in the browser.

### Campaigns (real and test)

The DM runs the tool on their own machine; nothing is hosted. `src/campaign/model.ts` holds pure functions over a JSON campaign file, and `src/persistence/campaign-files.ts` stores it in `campaigns/` (gitignored; `ARENTORIA_CAMPAIGN_DIR` overrides). There are two fixed campaigns: `party` (real) and `test` (restartable).

- **Published reports are immutable.** Publishing stores the engine state at the end of the stretch (a snapshot) plus a frozen, player-safe `EditionContent` (`src/views/edition.ts`, built through the player-view allow-list). Later runs continue from the latest snapshot, so a recalibration never rewrites published history.
- **The draft** is everything since the last report: the DM's recorded answers, acknowledged events, plan changes (from tomorrow), size changes and account entries, as scheduled interventions with unique `refId`s. It is replayed from the last snapshot on every request (cheap and deterministic), so the DM can rewind to the last report and run again without losing inputs.
- **Publishing** refuses while a question is due today, keeps answers to questions that are still open and changes that haven't happened yet, and keeps snapshots for the latest three reports (enough to undo). **Undo** turns the latest report back into a draft with its inputs restored, so re-publishing reproduces it exactly.
- The real campaign can be started over only before its first report. Every publish, undo and restart first copies the file to `campaigns/backups/`.
- All campaign routes (`/api/campaigns…`) are DM-only (`resolveRole`). `/api/campaigns/{id}/reports/{n}` returns a report's player-safe JSON, the shape DungeonShare will receive.

### The business account

The business keeps its own account, separate from the party's purses. Every money movement lands on a dated statement (`business.account.statement`):
- the opening capital;
- a weekly trading line (takings less running costs);
- every one-off cash effect from an event or decision;
- automatic payouts (if the plan uses them);
- DM-recorded withdrawals and deposits (`Effect` kind `account`), which change cash but never profit.

`engine/account.ts` derives the operating floor, what is safe to withdraw, the suppliers' credit limit and the account status (healthy, thin, overdrawn, cut off). Overdrafts have mechanical consequences in `economy.ts` and `simulate.ts`, and narrative ones in `world/events/conditional.ts`.

The API accepts `accountActions` only from the DM (`resolveRole`), and turns them into audited interventions. Scheduled interventions are idempotent: each has a `refId`, applied interventions are remembered in `state.appliedInterventions`, and anything scheduled for "first thing tomorrow" is applied when a run ends, so a withdrawal shows immediately and is never counted twice on replay.

### Business size and short reports

A plan carries a **business size** (`plan.stage`), defined in world data (`src/world/stages.ts`) as limits on outlets, staff, roles, weekly production, pushing the constructs and festival-day baking. `engine/stage.ts` lists any violations in plain sentences. `checkPlan` reports them as errors, `createInitialState` and plan revisions refuse them, and the API accepts a change of size only from the DM. Plans saved before sizes existed default to "unrestricted".

Weekly report lines carry an importance weight (events by severity, then threats, problems, customers, staff and weather). `markBrief` flags the summary plus the top three as the short report. The player view sends only those lines; the DM view sends all lines with the flag, and the UI shows the short version unless the DM asks for every note.

### Pacing

`world/pacing.ts` keeps the world from producing a crisis every week without breaking cause and effect. Opportunity and dilemma decisions are spaced at least 21 days apart and never stack. Adverse random events are damped for 14 days after a major event; this shows up as a named driver. Major thread escalations wait 14 days after any major event, and thread stages have repeat cooldowns. Threats are written to *resolve* (a crew backs off or forces a showdown, a feud burns out) rather than loop. Targets and measurements are in `docs/ASSUMPTIONS.md`; `tests/pacing.test.ts` guards them.

"Flag for the next session" is an option on major decisions. It freezes the thread and records an "awaiting in-person resolution" condition, so the DM can run it at the table and commit the outcome as an intervention.

## World Intervention Layer

Freeform actions ("We secretly follow our salesperson") will be handled like this:

1. A player submits a proposal (free text, optionally structured).
2. A suggested interpretation is prepared: possible checks, costs, affected variables, candidate effects. In Phase 2 this is DM tooling, optionally AI-assisted, and it is **never auto-applied**.
3. The DM adjudicates (at the table or directly) and approves a list of structured `Effect`s.
4. `applyIntervention(world, state, { authority, description, effects, refId, recordedAt })` applies them through the same choke point events use, and appends an `AppliedChange` with cause, authority, timestamp and effects.

The effect vocabulary already covers the brief's list: adjust variable, transfer cash, add or remove condition, temporary modifier, advance/reverse/freeze a thread (faction clock), schedule a future event, reveal information to players, change staff (NPC behavior), change the plan (validated), suspend operations, licensing status, wholesale accounts.

## Truth vs. belief

- The engine stores **what is true**: hidden variables, staff traits, skimmed money, thread progress, event probabilities.
- Players get **what they would learn**: the cash they counted (after skimming), sales and waste, weather, festivals, witnessed events, staff remarks filtered by loyalty, and street talk that warns of developing threads. `state.knowledge` holds facts explicitly revealed by effects.
- `views/buildPlayerView` is built by allow-listing, never by deleting fields. `tests/views.test.ts` asserts that no hidden key appears anywhere in the player payload.

## Permissions

Phase 1 is a DM sandbox without accounts. Roles are already resolved on the server (`src/server/access.ts`): if `ARENTORIA_DM_TOKEN` is set, the DM view requires the matching header. Phase 4 replaces this with Supabase Auth and campaign membership (`campaign_members.role`) plus RLS, so players have no read access to snapshots or the audit table.

## Canon policy

- `src/world/canon.ts` is the canon register. Only the DM adds to it.
- Proposed content is labelled `proposed` and shown as such in the app.
- All simulation output is `simulated`, and runs carry `branch: "sandbox"`.
- The canonical campaign clock does not advance with real time. In Phase 2 a canonical snapshot can only be saved with `approvedBy` (enforced in the repository and by a SQL check constraint).
