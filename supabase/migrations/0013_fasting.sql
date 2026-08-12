-- ArtaHealth · Migration 0013 · Mode Ramadan / Puasa (Fase 3)
-- Sumber: docs/addendum-ramadan.md §4. Fondasi sadar-puasa: konfigurasi mode +
-- status puasa harian. `fasting_days` = SATU-SATUNYA sumber kebenaran status
-- puasa; semua engine (scoring, hidrasi, reminder, habit) membaca tabel ini.
--
-- ⚠️ PRIVASI (addendum §2 aturan 2 + checklist §10): status not_fasting TIDAK
--    PERNAH menyimpan alasan (uzur haid/sakit/safar/menyusui adalah privasi).
--    Dilarang menambah kolom/analytics/log yang menyimpan atau menanyakan alasan.
--
-- Fitur di belakang feature flag sampai akurasi imsakiyah divalidasi vs Kemenag
-- (±2 mnt, ≥5 kota) & konten medis-puasa/keislaman direview (§3.3, §10).

-- ── Konfigurasi mode puasa per profil ───────────────────────────────────────
create table fasting_settings (
  profile_id       uuid primary key references profiles(id) on delete cascade,
  ramadan_enabled  boolean not null default false,
  ramadan_start    date,                    -- dikonfirmasi user (sidang isbat) — tak pernah dipaksa dari konversi
  ramadan_end      date,
  -- koordinat untuk perhitungan imsakiyah client-side (profil belum simpan koordinat)
  latitude         numeric(8,5),
  longitude        numeric(8,5),
  -- {senin_kamis, ayyamul_bidh, syawal6, arafah, asyura, daud}
  sunnah_schedules text[] not null default '{}',
  sahur_reminder_min int not null default 60 check (sahur_reminder_min between 0 and 240),
  -- koreksi manual ±menit per waktu (ihtiyati / kalibrasi lokal vs Kemenag)
  time_correction  jsonb not null default '{"imsak":0,"maghrib":0}',
  medical_ack_at   timestamptz,             -- interstitial keamanan medis (§3.3) di-acknowledge
  updated_at       timestamptz not null default now()
);

-- ── Status puasa per hari (sumber kebenaran tunggal) ────────────────────────
create table fasting_days (
  profile_id   uuid not null references profiles(id) on delete cascade,
  date         date not null,
  fasting_type text not null
               check (fasting_type in ('ramadan','senin_kamis','ayyamul_bidh','syawal','arafah','asyura','daud','qadha','nazar')),
  -- HANYA fasting|not_fasting — TANPA kolom alasan (by design, privasi)
  status       text not null default 'fasting' check (status in ('fasting','not_fasting')),
  confirmed    boolean not null default false,   -- true jika user konfirmasi eksplisit
  updated_at   timestamptz not null default now(),
  primary key (profile_id, date)
);
-- query engine & timeline: status hari X per profil, urut terbaru
create index idx_fasting_profile_date on fasting_days (profile_id, date desc);
-- pull-sync inkremental (pola migration 0006)
create index idx_fasting_days_profile_updated on fasting_days (profile_id, updated_at);

-- updated_at otomatis naik saat UPDATE (fungsi dari migration 0006)
create trigger trg_fasting_settings_updated_at
  before update on fasting_settings for each row execute function set_updated_at();
create trigger trg_fasting_days_updated_at
  before update on fasting_days for each row execute function set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table fasting_settings enable row level security;
alter table fasting_days enable row level security;

create policy "own_fasting_settings" on fasting_settings
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );

create policy "own_fasting_days" on fasting_days
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
