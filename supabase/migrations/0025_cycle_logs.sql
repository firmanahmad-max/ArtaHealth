-- ArtaHealth · Migration 0025 · Kesehatan Siklus (V3-5)
-- Catatan tanggal mulai haid per profil → prediksi siklus DETERMINISTIK di klien.
-- Data sensitif (kesehatan reproduksi) — RLS per pemilik akun; TIDAK pernah ke log/analytics.
-- Masuk SYNC_TABLES (id-keyed, seperti medical_documents/achievements). Di balik flag
-- NEXT_PUBLIC_FEATURE_CYCLE (inert sampai flag nyala).

create table cycle_logs (
  id          text primary key,          -- id lokal (uuid) — idempoten
  profile_id  uuid not null references profiles(id) on delete cascade,
  start_date  date not null,             -- tanggal mulai haid
  length_days integer,                   -- durasi haid (opsional)
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_cycle_logs_profile on cycle_logs (profile_id, start_date);

create trigger trg_cycle_logs_updated_at
  before update on cycle_logs for each row execute function set_updated_at();

alter table cycle_logs enable row level security;
create policy "own_cycle_logs" on cycle_logs
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
