-- DRAFT (Phase 2) — not applied anywhere. Intended for PostgreSQL / Supabase.
-- Principles:
--   * World state is stored as versioned JSONB snapshots produced by the pure engine.
--   * Canon advances only through DM-approved snapshots; sandbox/scenario branches never overwrite canon.
--   * Every applied change is recorded with cause, authority and effects (append-only audit).
--   * Players never read hidden state: they read published reports and player projections only.
--     Enforce with Row Level Security; the DM role reads everything for their campaign.

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  world_id text not null default 'arentoria',
  created_at timestamptz not null default now()
);

create table campaign_members (
  campaign_id uuid references campaigns(id) on delete cascade,
  user_id uuid not null,                       -- auth.users(id) in Supabase
  role text not null check (role in ('dm', 'player')),
  character_name text,
  primary key (campaign_id, user_id)
);

create table world_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  branch_kind text not null check (branch_kind in ('canon', 'sandbox', 'scenario')),
  branch_name text,                            -- null for canon
  parent_id uuid references world_snapshots(id),
  label text not null,
  sim_day integer not null,                    -- absolute day in the campaign calendar
  seed text not null,
  engine_version text not null,
  schema_version integer not null,
  state jsonb not null,                        -- WorldState (contains hidden state: DM-only)
  created_by uuid not null,
  created_at timestamptz not null default now(),
  approved_by uuid,                            -- required for canon
  approved_at timestamptz,
  check (branch_kind <> 'canon' or approved_by is not null)
);
create index on world_snapshots (campaign_id, branch_kind, created_at desc);

-- Append-only audit of applied changes (events, decisions, interventions, overrides).
create table applied_changes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  snapshot_id uuid not null references world_snapshots(id),
  sim_day integer not null,
  authority text not null check (authority in ('simulation', 'standing-order', 'sandbox-assumption', 'dm', 'players')),
  cause_kind text not null,
  cause_ref text not null,
  description text not null,
  effects jsonb not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid
);

-- Freeform player intentions awaiting DM adjudication (World Intervention Layer).
create table proposals (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  author_id uuid not null,
  kind text not null check (kind in ('plan-change', 'freeform-action', 'decision-response')),
  body text not null,                          -- "We disguise ourselves and watch the rival bakery."
  structured jsonb,                            -- plan patch or chosen option, when applicable
  suggested_interpretation jsonb,              -- optional AI/DM-tool suggestion; never applied automatically
  status text not null default 'open' check (status in ('open', 'voting', 'approved', 'amended', 'rejected', 'flagged-for-session', 'applied')),
  dm_notes text,
  approved_effects jsonb,                      -- the Effect[] the DM actually approved
  applied_change_id uuid references applied_changes(id),
  deadline timestamptz,
  created_at timestamptz not null default now()
);

create table votes (
  proposal_id uuid references proposals(id) on delete cascade,
  voter_id uuid not null,
  choice text not null,
  cast_at timestamptz not null default now(),
  primary key (proposal_id, voter_id)
);

-- Published, player-safe material (weekly reports, rumors, letters). Written by the server
-- from the player projection only, after the DM publishes a week.
create table published_reports (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  snapshot_id uuid not null references world_snapshots(id),
  week_index integer not null,
  body jsonb not null,                         -- PlayerView fragment: lines without DM basis
  published_by uuid not null,
  published_at timestamptz not null default now()
);

-- RLS sketch (Supabase):
--   alter table world_snapshots enable row level security;
--   create policy dm_reads_state on world_snapshots for select using (
--     exists (select 1 from campaign_members m where m.campaign_id = world_snapshots.campaign_id
--             and m.user_id = auth.uid() and m.role = 'dm'));
--   -- players get no policy on world_snapshots or applied_changes at all;
--   -- they read published_reports, their own proposals and votes.
