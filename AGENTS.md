# AGENTS.md — Arentoria Living World

## Mission
A living-world simulation companion for a D&D campaign. Make player decisions matter, keep the DM in charge, and keep the simulation explainable.

## Non-negotiable rules
- `src/engine` is pure and deterministic: no React/Next, no I/O, no wall-clock time, no `Math.random`. All randomness goes through `rngFor(seed, ...keys)` with a distinct key per subsystem.
- The engine never imports `src/world`. World content is injected as a `WorldDefinition`.
- Every world item carries provenance (`canon` / `proposed` / `provisional` / `simulated`). Never present proposed or simulated content as canon. Only the DM adds to `src/world/canon.ts`.
- State changes from events, decisions and interventions go through `Effect`s and `applyChange`, so they are audited.
- Hidden state never reaches a client: build player payloads with `buildPlayerView` (allow-list), and keep client components free of engine/world imports (`tests/boundaries.test.ts`).
- Narrative text must describe actual simulated conditions. Each report line needs a DM `basis`.
- Numbers are provisional. Put new constants in `src/world/assumptions.ts` (or neighborhood/channel data), not inline in the engine.
- Do not deploy or touch external accounts without explicit authorization.

## Checks before finishing
```
npm run typecheck
npm test
npm run build
npm run compare -- --runs 20 --weeks 26   # when changing calibration or events
```
If a calibration change breaks `tests/strategy.test.ts`, treat it as a design question and flag it rather than loosening the test silently.
