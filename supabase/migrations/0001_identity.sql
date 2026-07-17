-- ArtaHealth · Migration 0001 · Identity
-- Sumber: docs/technical-blueprint.md §3.2 (identity) — Fase 1

create extension if not exists pgcrypto;

create table profiles (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  relation      text not null default 'self'
                check (relation in ('self','father','mother','child','elder','other')),
  date_of_birth date,
  sex           text check (sex in ('male','female')),
  height_cm     numeric(5,2) check (height_cm between 50 and 250),
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_profiles_account on profiles (account_id) where deleted_at is null;
-- satu profil primary per akun
create unique index uq_profiles_primary on profiles (account_id) where is_primary and deleted_at is null;

create table emergency_cards (
  profile_id      uuid primary key references profiles(id) on delete cascade,
  blood_type      text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies       text[] not null default '{}',
  conditions      text[] not null default '{}',
  emergency_contacts jsonb not null default '[]',
  -- Kolom *_enc menyimpan ciphertext (pgsodium, dienkripsi via Edge Function - Fase 6 Vault);
  -- hingga fitur aktif kolom dibiarkan null. JANGAN tulis plaintext ke kolom ini.
  bpjs_number_enc text,
  insurance_enc   text,
  updated_at      timestamptz not null default now()
);

-- ===== RLS =====
alter table profiles enable row level security;
alter table emergency_cards enable row level security;

create policy "own_profiles" on profiles
  for all using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy "own_emergency_cards" on emergency_cards
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
