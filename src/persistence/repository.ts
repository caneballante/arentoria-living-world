/**
 * Persistence boundary (Phase 2 will add a Postgres/Supabase implementation).
 *
 * The engine never touches storage. Application code loads a WorldState snapshot,
 * runs the pure engine, and — only after DM approval — saves a new canonical
 * snapshot plus the audit records that justify it. Sandbox and scenario branches are
 * stored separately and can never overwrite canon.
 *
 * See db/schema.draft.sql for the intended relational layout.
 */
import { restore, snapshot } from "../engine/simulate";
import type { AppliedChange, WorldState } from "../engine/types";

export type Branch = { kind: "canon" } | { kind: "sandbox" | "scenario"; name: string };

export interface SnapshotMeta {
  id: string;
  campaignId: string;
  branch: Branch;
  label: string;
  day: number;
  seed: string;
  createdBy: string;
  createdAt: string;
  /** Canon snapshots require an explicit DM approval record. */
  approvedBy?: string;
  parentId?: string;
}

export interface CampaignRepository {
  saveSnapshot(meta: Omit<SnapshotMeta, "id" | "createdAt">, state: WorldState): Promise<SnapshotMeta>;
  loadSnapshot(id: string): Promise<{ meta: SnapshotMeta; state: WorldState } | null>;
  latest(campaignId: string, branch: Branch): Promise<{ meta: SnapshotMeta; state: WorldState } | null>;
  listSnapshots(campaignId: string): Promise<SnapshotMeta[]>;
  appendChanges(campaignId: string, snapshotId: string, changes: AppliedChange[]): Promise<void>;
  changes(campaignId: string): Promise<(AppliedChange & { snapshotId: string })[]>;
}

const sameBranch = (a: Branch, b: Branch) => a.kind === b.kind && (a.kind === "canon" || (b.kind !== "canon" && a.name === b.name));

/** Reference implementation for tests and local tooling. Stores JSON text, like a database would. */
export class InMemoryRepository implements CampaignRepository {
  private snapshots = new Map<string, { meta: SnapshotMeta; json: string }>();
  private log: (AppliedChange & { snapshotId: string; campaignId: string })[] = [];
  private counter = 0;
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async saveSnapshot(meta: Omit<SnapshotMeta, "id" | "createdAt">, state: WorldState): Promise<SnapshotMeta> {
    if (meta.branch.kind === "canon" && !meta.approvedBy) throw new Error("Canonical snapshots require DM approval (approvedBy).");
    const full: SnapshotMeta = { ...meta, id: `snap-${++this.counter}`, createdAt: this.now() };
    this.snapshots.set(full.id, { meta: full, json: snapshot(state) });
    return full;
  }
  async loadSnapshot(id: string) {
    const s = this.snapshots.get(id);
    return s ? { meta: s.meta, state: restore(s.json) } : null;
  }
  async latest(campaignId: string, branch: Branch) {
    const all = [...this.snapshots.values()].filter((s) => s.meta.campaignId === campaignId && sameBranch(s.meta.branch, branch));
    const last = all[all.length - 1];
    return last ? { meta: last.meta, state: restore(last.json) } : null;
  }
  async listSnapshots(campaignId: string) {
    return [...this.snapshots.values()].filter((s) => s.meta.campaignId === campaignId).map((s) => s.meta);
  }
  async appendChanges(campaignId: string, snapshotId: string, changes: AppliedChange[]) {
    this.log.push(...changes.map((c) => ({ ...c, snapshotId, campaignId })));
  }
  async changes(campaignId: string) {
    return this.log.filter((c) => c.campaignId === campaignId).map(({ campaignId: _c, ...rest }) => rest);
  }
}
