/**
 * Every piece of world content and every simulated fact carries provenance, so the
 * application can always tell established campaign canon apart from proposals and
 * from things the simulation generated.
 *
 *  - canon:       established at the table or in campaign documents.
 *  - proposed:    worldbuilding drafted for the app; not canon until the DM adopts it.
 *  - provisional: a tunable modelling assumption (numbers, rates, formulas' constants).
 *  - simulated:   produced by the engine in a run. Never canon unless the DM promotes it
 *                 through an explicit, recorded action.
 */
export type ProvenanceStatus = "canon" | "proposed" | "provisional" | "simulated";

export interface Provenance {
  status: ProvenanceStatus;
  /** Where it came from (session, document, design note). */
  source?: string;
  note?: string;
}

export const canon = (source: string, note?: string): Provenance => ({ status: "canon", source, note });
export const proposed = (note?: string): Provenance => ({ status: "proposed", note });
export const provisional = (note?: string): Provenance => ({ status: "provisional", note });
