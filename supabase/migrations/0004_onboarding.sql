-- ArtaHealth · Migration 0004 · Onboarding & Consent
-- Sumber: docs/ui-ux-spec.md §3.8 (onboarding 5 langkah) + technical-blueprint.md §7.2 (consents, UU PDP)

-- Data dasar & preferensi onboarding — target utama menentukan bobot rekomendasi awal.
alter table profiles
  add column primary_goal text
    check (primary_goal in ('fitter','better_sleep','lose_weight','build_habits')),
  add column timezone text not null default 'Asia/Jakarta',
  add column target_hydration_ml int not null default 2500
    check (target_hydration_ml between 500 and 6000),
  add column target_steps int not null default 8000
    check (target_steps between 1000 and 50000),
  add column target_sleep_min int not null default 480
    check (target_sleep_min between 240 and 720),
  add column onboarded_at timestamptz;

-- Persetujuan eksplisit per poin (UU PDP Pasal 20 — bukan satu checkbox borongan).
-- Revoke = isi revoked_at (audit trail dipertahankan, bukan delete).
create table consents (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,
  consent_key text not null check (consent_key in (
    'health_data_processing',  -- wajib: pemrosesan data kesehatan untuk fitur inti
    'ai_analysis',             -- analisis AI atas data kesehatan (insight & chat)
    'notifications'            -- pengingat & notifikasi personal
  )),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  unique (account_id, consent_key)
);
create index idx_consents_account on consents (account_id) where revoked_at is null;

alter table consents enable row level security;
create policy "own_consents" on consents
  for all using (account_id = auth.uid()) with check (account_id = auth.uid());
