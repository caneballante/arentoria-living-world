# Related projects: inspection notes

Inspected on 2026-11-22 (read-only):

- `caneballante/systemic-risk-model` (the "systemic-risk-model-v0.1" in the brief): Vite + React 19 + TypeScript + zod 4 + Vitest. A causal-model *inspection workbench*. Its README states it is "not a simulation engine".
- `caneballante/puget-sound-evidence-explorer`: the same stack, an evidence and hypothesis workspace with IndexedDB persistence, separated from the model explorer.

## What exists there vs. what the brief asked about

| Capability | Found? | Notes |
|---|---|---|
| Deterministic simulation / seeded RNG | No | No RNG anywhere (only `crypto.randomUUID` for ids). Built fresh here: `src/engine/rng.ts`. |
| State transitions / scenario management | Partly | `scenario.ts` defines *qualitative scenario overlays* (observations bound to a model id and version), validated with zod. No state propagation. |
| Stocks, flows, feedback loops, delays | Schemas only | `domain.ts` has rich zod schemas for Stock, Flow, Parameter, Mechanism, Buffer, Lag, with epistemic status fields; `analysis.ts` finds strongly connected components and classifies feedback cycles as reinforcing or balancing. Nothing executes dynamics. |
| Parameter definitions & validation | Yes (schema) | `ParameterSchema` with `status: unknown / assumed / literature_estimate / empirically_estimated / calibrated`, range, distribution. |
| Scenario comparison / simulation history | No | |
| Visualization / debugging | Yes | Hand-rolled SVG graph (no chart library), deterministic Markdown/JSON exports, structural audit reports. |

## What was reused (ideas, not code)

- **Provenance and epistemic status.** Their `mechanism_status` / `parameter.status` vocabulary inspired `Provenance` here (`canon / proposed / provisional / simulated`) and the rule "do not silently promote provisional to accepted", which the brief also requires.
- **zod validation at the boundary.** Plans are validated with zod 4, as their registries are.
- **Boundary tests.** `tests/boundaries.test.ts` adapts the puget repo's `separation.test.ts` idea (scan imports to enforce independence) to enforce engine purity and keep hidden state off the client.
- **Dependency-free SVG charts.** The same choice as their atlas.
- **Same toolchain family.** TypeScript, React 19, zod 4 and Vitest, so code can move between projects later.

No source files were copied and no dependency on either repository was introduced.

## Possible later integrations

1. **Causal-structure audit of Arentoria's dynamics.** Express the hidden-state drivers (`src/engine/dynamics.ts`) as a registry in their schema (variables, relationships, polarity), then run `analysis.ts`'s SCC and cycle-polarity tools to document Arentoria's reinforcing and balancing loops. That gives a "why is the world behaving like this" map for the DM.
2. **Parameter registry.** Move `src/world/assumptions.ts` to a JSON registry using their `ParameterSchema` shape (value, range, status, evidence/notes). The UI could then show calibration status per parameter ("assumed" vs "calibrated at the table").
3. **Deterministic exports.** Their focused Markdown/JSON export pattern suits "session prep packets" (Phase 3/5).
4. **Feeding back.** Arentoria's seeded RNG, stock/flow runner and paired-seed comparison could become the "Simulation" layer their `STRUCTURAL_ANALYSIS.md` lists as future work. Their AGENTS.md currently forbids simulation without an explicit request, so that would be a separate decision.
