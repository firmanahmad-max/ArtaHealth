-- ArtaHealth · Migration 0015 · Medicine Reminder (Fase 3 · modul obat, V2)
-- Sumber: technical-blueprint.md §3 (medications, medication_intakes). Prasyarat
-- deteksi konflik jadwal obat vs jam puasa (addendum-ramadan §3.3 baris 2).
--
-- Aplikasi TIDAK PERNAH menyarankan waktu/dosis obat (CONTEXT §4) — hanya
-- menyimpan jadwal yang diisi user & mendeteksi konflik untuk diarahkan ke dokter.
-- Offline-first (updated_at pull-sync pola 0006, tombstone deleted_at).
-- Fitur di belakang feature flag sampai siap.

create table medications (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  name         text not null,
  dosage       text,
  -- {times: ["08:00","20:00"], days: [1..7] (kosong = tiap hari)}
  schedule     jsonb not null default '{"times":[],"days":[]}',
  stock        int check (stock is null or stock >= 0),
  stock_alert  int not null default 5,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index idx_medications_profile_updated on medications (profile_id, updated_at);
create index idx_medications_active on medications (profile_id) where is_active and deleted_at is null;

create table medication_intakes (
  id            uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  scheduled_at  timestamptz not null,
  taken_at      timestamptz,
  status        text not null default 'pending' check (status in ('pending','taken','skipped','missed')),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
-- non-unik (sinkron via PK id, pola habits/monitored_conditions); "satu intake per
-- dosis" ditegakkan di app (reuse id lokal) agar upsert-by-id tak bentrok antar perangkat
create index idx_medication_intake_dose on medication_intakes (medication_id, scheduled_at) where deleted_at is null;
create index idx_medication_intakes_profile_updated on medication_intakes (profile_id, updated_at);

create trigger trg_medications_updated_at
  before update on medications for each row execute function set_updated_at();
create trigger trg_medication_intakes_updated_at
  before update on medication_intakes for each row execute function set_updated_at();

-- ===== RLS =====
alter table medications enable row level security;
alter table medication_intakes enable row level security;

create policy "own_medications" on medications
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );

create policy "own_medication_intakes" on medication_intakes
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
