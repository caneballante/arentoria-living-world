# Roadmap

## Phase 1: working simulation prototype (this delivery)

Done:

- Proposed calendar (13×28 + Council Day), seasons, weekdays, market and rest days, festivals.
- Persistent weather with temporal correlation, and seasonal ingredient and fuel prices.
- Three modelled neighborhoods (Commons, Grand Market, High March) and four sales channels.
- A business plan with all twelve decisions plus standing orders (zod-validated).
- Daily production and sales, weekly accounting, cash, owner draws and reinvestment.
- Hidden state as stocks and flows with named drivers; derived resilience and vulnerability.
- Ten conditional/opportunity events, four multi-stage threads and two scheduled events.
- Pauses mid-week, decisions (player and DM), "flag for session", deterministic replay, snapshots.
- An intervention commit point with an audit trail; player and DM projections; weekly narrative reports.
- Seeded batch comparison across nine strategies at 26/52 weeks; CLI and web UI.
- 64 automated tests.

Next small steps (before Phase 2):

- Calibrate with the DM using the questions in `docs/ASSUMPTIONS.md`.
- Add a one-factor sensitivity view ("what if only the price changed?") to the compare page.
- Mid-season plan changes in the sandbox UI (the engine already supports them as `plan` effects).

## Phase 2: world state and interventions

- Supabase project and the schema in `db/schema.draft.sql`: campaigns, members, snapshots, applied changes, proposals.
- **Canonical campaign clock**: the DM advances canon week by week. Each advance is a provisional run, then a DM review, then an approved snapshot.
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
