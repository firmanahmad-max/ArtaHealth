-- ArtaHealth · Migration 0016 · Sadar Gizi (Fase 4 · NG-1)
-- Sumber: docs/addendum-sadar-gizi.md §4. Tabel ambang gizi BER-VERSI (pola
-- biomarker_bands) untuk traffic-light per nutrien + personalisasi kondisi.
--
-- ⚠️ SELURUH ANGKA DI SEED INI ADALAH KERANGKA AWAL — WAJIB DIVERIFIKASI vs
--    dokumen resmi (Permenkes GGL/G4G1L5, BPOM ING/Nutri-Level, basis %AKG 2150
--    kkal) + review ahli gizi/tenaga medis sebelum flag dinyalakan (checklist §11).
--    Sampai itu, fitur tampil di belakang feature flag (tidak ke pengguna nyata).

create table nutrition_bands (
  id            uuid primary key default gen_random_uuid(),
  nutrient      text not null check (nutrient in ('sugar','sodium','sat_fat','total_fat','fiber','protein')),
  food_form     text not null check (food_form in ('solid','beverage')),  -- ambang minuman ≠ padatan
  band_key      text not null check (band_key in ('low','medium','high')),
  zone          text not null check (zone in ('green','yellow','red')),
  -- interval per 100 g/ml, setengah-terbuka [per_100_min, per_100_max)
  per_100_min   numeric,
  per_100_max   numeric,
  condition_tag text check (condition_tag in ('hypertension','diabetes','dyslipidemia','gout')), -- null = umum
  guideline_ref text not null,
  version       int not null default 1,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index uq_nutrition_bands
  on nutrition_bands (nutrient, food_form, coalesce(condition_tag,'umum'), band_key, version);
create index idx_nutrition_bands_lookup
  on nutrition_bands (nutrient, food_form, version) where active;

-- ===== RLS: referensi publik (tanpa PII) — baca utk authenticated; tulis via migrasi =====
alter table nutrition_bands enable row level security;
create policy "read_nutrition_bands" on nutrition_bands for select to authenticated using (true);

-- ===== SEED v1 (kerangka — ⚠️ VERIFIKASI AHLI GIZI SEBELUM PRODUKSI) =====
-- Traffic light per 100 g/ml (mengacu pola FSA/Nutri-Level + GGL Kemenkes).
insert into nutrition_bands (nutrient, food_form, band_key, zone, per_100_min, per_100_max, guideline_ref) values
  -- Gula — minuman (lebih ketat) vs padatan
  ('sugar','beverage','low',   'green',  null, 2.5,  'BPOM Nutri-Level (kerangka)'),
  ('sugar','beverage','medium','yellow', 2.5,  7.5,  'BPOM Nutri-Level (kerangka)'),
  ('sugar','beverage','high',  'red',    7.5,  null, 'BPOM Nutri-Level (kerangka)'),
  ('sugar','solid','low',   'green',  null, 5.0,  'BPOM Nutri-Level (kerangka)'),
  ('sugar','solid','medium','yellow', 5.0,  22.5, 'BPOM Nutri-Level (kerangka)'),
  ('sugar','solid','high',  'red',    22.5, null, 'BPOM Nutri-Level (kerangka)'),
  -- Natrium (per 100) — sama utk padatan & minuman
  ('sodium','solid','low',   'green',  null, 120,  'BPOM Nutri-Level (kerangka)'),
  ('sodium','solid','medium','yellow', 120,  600,  'BPOM Nutri-Level (kerangka)'),
  ('sodium','solid','high',  'red',    600,  null, 'BPOM Nutri-Level (kerangka)'),
  ('sodium','beverage','low',   'green',  null, 120,  'BPOM Nutri-Level (kerangka)'),
  ('sodium','beverage','medium','yellow', 120,  600,  'BPOM Nutri-Level (kerangka)'),
  ('sodium','beverage','high',  'red',    600,  null, 'BPOM Nutri-Level (kerangka)'),
  -- Lemak jenuh
  ('sat_fat','solid','low',   'green',  null, 1.5,  'BPOM Nutri-Level (kerangka)'),
  ('sat_fat','solid','medium','yellow', 1.5,  5.0,  'BPOM Nutri-Level (kerangka)'),
  ('sat_fat','solid','high',  'red',    5.0,  null, 'BPOM Nutri-Level (kerangka)'),
  ('sat_fat','beverage','low',   'green',  null, 1.5,  'BPOM Nutri-Level (kerangka)'),
  ('sat_fat','beverage','medium','yellow', 1.5,  5.0,  'BPOM Nutri-Level (kerangka)'),
  ('sat_fat','beverage','high',  'red',    5.0,  null, 'BPOM Nutri-Level (kerangka)');
