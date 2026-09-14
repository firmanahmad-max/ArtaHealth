-- ArtaHealth · Migration 0026 · Wearable / Health Connect (V3-7 · WR-1)
-- Sampel pasif dari perangkat (langkah/detak/tidur/energi/berat/SpO₂) — ber-SUMBER agar
-- provenance jelas dan TAK mengubah tabel log manual (activity/sleep/weight tetap stabil).
-- Data kesehatan T1: RLS per pemilik akun; TIDAK pernah ke log/analytics/Sentry.
-- id-keyed (pola cycle_logs/medical_documents) → masuk SYNC_TABLES. `external_id` men-DEDUP
-- sampel platform saat re-sync. Inert sampai flag NEXT_PUBLIC_FEATURE_WEARABLE + native (WR-2).

create table wearable_samples (
  id          text primary key,          -- id lokal (`${source}:${external_id}`) — idempoten
  profile_id  uuid not null references profiles(id) on delete cascade,
  type        text not null,             -- steps|heart_rate|sleep|active_energy|weight|spo2
  value       double precision not null,
  unit        text not null,
  start_at    timestamptz not null,
  end_at      timestamptz,
  source      text not null,             -- health_connect|healthkit
  external_id text not null,             -- id sampel platform (dedup)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
-- query rollup: per profil, per jenis, urut waktu
create index idx_wearable_samples_profile on wearable_samples (profile_id, type, start_at);
-- idempotensi lintas-perangkat: satu sampel platform per profil
create unique index uq_wearable_samples_ext on wearable_samples (profile_id, source, external_id);

create trigger trg_wearable_samples_updated_at
  before update on wearable_samples for each row execute function set_updated_at();

alter table wearable_samples enable row level security;
create policy "own_wearable_samples" on wearable_samples
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
