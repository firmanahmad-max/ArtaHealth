-- ArtaHealth · Migration 0010 · Silent Killer Guard (Fase 2)
-- Sumber: docs/addendum-silent-killer.md. Modul biomarker: klasifikasi
-- deterministik tekanan darah & gula darah terhadap ambang GUIDELINE RESMI
-- (PERHI/InaSH, PERKENI), disimpan sebagai DATA KONFIGURASI BER-VERSI
-- (tabel biomarker_bands) — bukan hardcoded, agar bisa diperbarui setelah
-- review medis tanpa deploy ulang engine.
--
-- ⚠️ AMBANG DI SEED INI WAJIB DIVERIFIKASI DOKTER SEBELUM PRODUKSI (checklist §5).
--    Sampai itu, fitur tampil di belakang feature flag (tidak ke pengguna nyata).
--
-- V1.5: BP + glukosa (di-seed di sini). Lipid & asam urat (V2) menyusul —
-- tabel & engine sudah dirancang extensible (kolom sex untuk ambang sadar-gender).

-- ============================================================================
-- 1) biomarker_bands — referensi klinis ber-versi (global, bukan per-pengguna)
-- ============================================================================
create table biomarker_bands (
  id            uuid primary key default gen_random_uuid(),
  biomarker     text not null check (biomarker in ('bp','glucose','lipid','uric_acid')),
  -- sub-parameter: systolic/diastolic · gdp/gds/pp2/hba1c · total_chol/ldl/hdl/tg · uric_acid
  parameter     text not null,
  -- null = berlaku untuk semua; 'male'/'female' untuk ambang sadar-gender (asam urat)
  sex           text check (sex in ('male','female')),
  band_key      text not null,             -- kunci mesin: optimal/normal/high_normal/ht1/dm/predm…
  label         text not null,             -- label tampil (Bahasa): "Normal-Tinggi"
  zone          text not null check (zone in ('green','yellow','orange','red')),
  -- interval setengah-terbuka [min_value, max_value): null = tak berhingga di sisi itu
  min_value     numeric,
  max_value     numeric,
  rank          int not null,              -- urutan keparahan (0 = terbaik); dipakai "ambil kategori tertinggi"
  unit          text not null,             -- mmHg · mg/dL · %
  guideline_ref text not null,             -- mis. "PERHI/InaSH 2021"
  version       int not null default 1,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
-- satu band unik per (biomarker, parameter, sex, band_key, versi)
create unique index uq_biomarker_bands
  on biomarker_bands (biomarker, parameter, coalesce(sex,'all'), band_key, version);
-- query engine: ambil band aktif suatu parameter, urut rank
create index idx_biomarker_bands_lookup
  on biomarker_bands (biomarker, parameter, version) where active;

-- ============================================================================
-- 2) biomarker_readings — hasil ukur per-profil (offline-first, ikut sync)
-- ============================================================================
create table biomarker_readings (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  client_id      text not null,            -- idempotensi (pola log Fase 1)
  biomarker      text not null check (biomarker in ('bp','glucose','lipid','uric_acid')),
  -- konteks pengukuran (glukosa WAJIB: gdp/gds/pp2/hba1c — klasifikasi beda per konteks)
  context        text,
  values         jsonb not null,           -- mis. {"systolic":130,"diastolic":85} · {"value":110}
  -- hasil engine di-cache untuk tampilan cepat/offline; sumber kebenaran tetap engine deterministik
  classification jsonb,                    -- {band_key,label,zone,rank,redFlag}
  measured_at    timestamptz not null,
  note           text check (char_length(note) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz               -- tombstone (hapus terpropagasi antar perangkat)
);
create unique index uq_biomarker_readings_client on biomarker_readings (profile_id, client_id);
-- pull-sync inkremental (pola migration 0006) + query trend per biomarker
create index idx_biomarker_readings_profile_updated on biomarker_readings (profile_id, updated_at);
create index idx_biomarker_readings_trend
  on biomarker_readings (profile_id, biomarker, measured_at) where deleted_at is null;
create trigger trg_biomarker_readings_updated_at
  before update on biomarker_readings for each row execute function set_updated_at();

-- ============================================================================
-- 3) monitored_conditions — kondisi yang dipantau pengguna (per-profil)
-- ============================================================================
create table monitored_conditions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  condition   text not null check (condition in ('hypertension','diabetes','dyslipidemia','hyperuricemia')),
  status      text not null default 'monitoring' check (status in ('monitoring','controlled','resolved')),
  since       date,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create unique index uq_monitored_conditions on monitored_conditions (profile_id, condition) where deleted_at is null;
create index idx_monitored_conditions_profile_updated on monitored_conditions (profile_id, updated_at);
create trigger trg_monitored_conditions_updated_at
  before update on monitored_conditions for each row execute function set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table biomarker_bands enable row level security;
alter table biomarker_readings enable row level security;
alter table monitored_conditions enable row level security;

-- biomarker_bands: referensi klinis publik (tanpa PII) → semua user terautentikasi boleh BACA.
-- Tulis hanya lewat migrasi/service_role (tak ada policy write untuk authenticated).
create policy "read_biomarker_bands" on biomarker_bands
  for select to authenticated using (true);

create policy "own_biomarker_readings" on biomarker_readings
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );

create policy "own_monitored_conditions" on monitored_conditions
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );

-- ============================================================================
-- SEED · biomarker_bands v1 — ⚠️ VERIFIKASI DOKTER SEBELUM PRODUKSI
-- ============================================================================
-- A) Tekanan darah — PERHI/InaSH. Klasifikasi = kategori TERTINGGI dari sistolik/diastolik.
--    HT derajat 2 (≥180/110) diperlakukan sebagai red-flag di engine (aturan keselamatan).
insert into biomarker_bands (biomarker, parameter, band_key, label, zone, min_value, max_value, rank, unit, guideline_ref) values
  ('bp','systolic','optimal',    'Optimal',      'green',  null, 120, 0, 'mmHg','PERHI/InaSH 2021'),
  ('bp','systolic','normal',     'Normal',       'green',  120,  130, 1, 'mmHg','PERHI/InaSH 2021'),
  ('bp','systolic','high_normal','Normal-Tinggi','yellow', 130,  140, 2, 'mmHg','PERHI/InaSH 2021'),
  ('bp','systolic','ht1',        'Hipertensi Derajat 1','orange', 140, 160, 3, 'mmHg','PERHI/InaSH 2021'),
  ('bp','systolic','ht2',        'Hipertensi Derajat 2','red',    160, 180, 4, 'mmHg','PERHI/InaSH 2021'),
  ('bp','systolic','ht3',        'Hipertensi Derajat 3','red',    180, null, 5, 'mmHg','PERHI/InaSH 2021'),
  ('bp','diastolic','optimal',    'Optimal',      'green',  null, 80, 0, 'mmHg','PERHI/InaSH 2021'),
  ('bp','diastolic','normal',     'Normal',       'green',  80,   85, 1, 'mmHg','PERHI/InaSH 2021'),
  ('bp','diastolic','high_normal','Normal-Tinggi','yellow', 85,   90, 2, 'mmHg','PERHI/InaSH 2021'),
  ('bp','diastolic','ht1',        'Hipertensi Derajat 1','orange', 90, 100, 3, 'mmHg','PERHI/InaSH 2021'),
  ('bp','diastolic','ht2',        'Hipertensi Derajat 2','red',    100, 110, 4, 'mmHg','PERHI/InaSH 2021'),
  ('bp','diastolic','ht3',        'Hipertensi Derajat 3','red',    110, null, 5, 'mmHg','PERHI/InaSH 2021');

-- B) Gula darah — PERKENI. Konteks menentukan ambang.
--    GDP = gula darah puasa · GDS = sewaktu · PP2 = 2 jam setelah makan/TTGO · HbA1c (%).
--    Hipoglikemia (<70) & krisis hiperglikemia (≥300) = red-flag di engine.
insert into biomarker_bands (biomarker, parameter, band_key, label, zone, min_value, max_value, rank, unit, guideline_ref) values
  ('glucose','gdp','normal', 'Normal',      'green',  null, 100, 0, 'mg/dL','PERKENI 2021'),
  ('glucose','gdp','predm',  'Prediabetes', 'yellow', 100,  126, 1, 'mg/dL','PERKENI 2021'),
  ('glucose','gdp','dm',     'Diabetes',    'red',    126,  null, 2, 'mg/dL','PERKENI 2021'),
  ('glucose','gds','normal', 'Normal',      'green',  null, 140, 0, 'mg/dL','PERKENI 2021'),
  ('glucose','gds','predm',  'Prediabetes', 'yellow', 140,  200, 1, 'mg/dL','PERKENI 2021'),
  ('glucose','gds','dm',     'Diabetes',    'red',    200,  null, 2, 'mg/dL','PERKENI 2021'),
  ('glucose','pp2','normal', 'Normal',      'green',  null, 140, 0, 'mg/dL','PERKENI 2021'),
  ('glucose','pp2','predm',  'Prediabetes', 'yellow', 140,  200, 1, 'mg/dL','PERKENI 2021'),
  ('glucose','pp2','dm',     'Diabetes',    'red',    200,  null, 2, 'mg/dL','PERKENI 2021'),
  ('glucose','hba1c','normal', 'Normal',      'green',  null, 5.7, 0, '%','PERKENI 2021'),
  ('glucose','hba1c','predm',  'Prediabetes', 'yellow', 5.7,  6.5, 1, '%','PERKENI 2021'),
  ('glucose','hba1c','dm',     'Diabetes',    'red',    6.5,  null, 2, '%','PERKENI 2021');
