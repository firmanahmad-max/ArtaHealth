-- ArtaHealth · Migration 0023 · Gamification — persistensi reward (Fase 6 #6 · GM-2)
-- Sumber: blueprint §3 (player_stats + achievements, V2). Event log satu tabel:
--   * badge  → dicatat saat pertama diraih (earned_at), day = null
--   * mission → misi harian tuntas → bonus XP DIBANK per hari (day = hari lokal)
-- Id DETERMINISTIK ('<profile>:<kind>:<key>:<day>') → idempoten & aman lintas-perangkat
-- (dua perangkat menghasilkan id sama → tak dobel). XP/level tetap DITURUNKAN di klien:
--   total = computeXp(aktivitas tersinkron) + Σ xp misi tersimpan.
-- Offline-first + tombstone. RLS per profil pemilik akun. Di belakang feature flag
-- (NEXT_PUBLIC_FEATURE_GAMIFICATION) — inert sampai flag dinyalakan.

create table achievements (
  id          text primary key,      -- '<profile_id>:<kind>:<key>:<day?>'
  profile_id  uuid not null references profiles(id) on delete cascade,
  kind        text not null,         -- 'badge' | 'mission'
  key         text not null,         -- badge key atau mission key
  day         date,                  -- null utk badge; hari lokal utk misi
  xp          integer not null default 0,   -- bonus XP (misi); 0 utk badge
  earned_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_achievements_profile_updated on achievements (profile_id, updated_at);

create trigger trg_achievements_updated_at
  before update on achievements for each row execute function set_updated_at();

alter table achievements enable row level security;
create policy "own_achievements" on achievements
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
