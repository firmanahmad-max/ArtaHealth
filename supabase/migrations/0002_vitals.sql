-- ArtaHealth · Migration 0002 · Vitals (offline-first logs)
-- Sumber: docs/technical-blueprint.md §3.2 (vitals) — Fase 1
-- Pola wajib: profile_id + client_id (idempotency) + soft delete + RLS.

create table hydration_logs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  beverage    text not null default 'water'
              check (beverage in ('water','coffee','tea','milk','juice')),
  volume_ml   int not null check (volume_ml between 1 and 5000),
  logged_at   timestamptz not null default now(),
  source      text not null default 'manual' check (source in ('manual','quick_add','voice','wearable','bot')),
  client_id   text not null,
  deleted_at  timestamptz,
  unique (profile_id, client_id)
);

create table sleep_logs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  sleep_start timestamptz not null,
  sleep_end   timestamptz not null,
  quality     smallint check (quality between 1 and 5),
  source      text not null default 'manual',
  client_id   text not null,
  deleted_at  timestamptz,
  unique (profile_id, client_id),
  check (sleep_end > sleep_start)
);

create table activity_logs (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id),
  activity_type text not null
                check (activity_type in ('walk','run','cycle','gym','stretch','yoga','other')),
  duration_min  int check (duration_min between 1 and 600),
  steps         int check (steps between 0 and 100000),
  calories_out  int check (calories_out between 0 and 5000),
  logged_at     timestamptz not null default now(),
  source        text not null default 'manual',
  client_id     text not null,
  deleted_at    timestamptz,
  unique (profile_id, client_id)
);

create table weight_logs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  weight_kg   numeric(5,2) not null check (weight_kg between 20 and 400),
  logged_at   timestamptz not null default now(),
  client_id   text not null,
  deleted_at  timestamptz,
  unique (profile_id, client_id)
);

create table mood_logs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  mood        smallint not null check (mood between 1 and 5),
  note        text check (char_length(note) <= 500),
  logged_at   timestamptz not null default now(),
  client_id   text not null,
  deleted_at  timestamptz,
  unique (profile_id, client_id)
);

-- Index time-series
create index idx_hydration_profile_time on hydration_logs (profile_id, logged_at desc) where deleted_at is null;
create index idx_sleep_profile_time     on sleep_logs (profile_id, sleep_start desc) where deleted_at is null;
create index idx_activity_profile_time  on activity_logs (profile_id, logged_at desc) where deleted_at is null;
create index idx_weight_profile_time    on weight_logs (profile_id, logged_at desc) where deleted_at is null;
create index idx_mood_profile_time      on mood_logs (profile_id, logged_at desc) where deleted_at is null;

-- ===== RLS (pola sama untuk semua) =====
do $$
declare t text;
begin
  foreach t in array array['hydration_logs','sleep_logs','activity_logs','weight_logs','mood_logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format($p$
      create policy "own_%s" on %I
        for all using (
          profile_id in (select id from profiles where account_id = auth.uid())
        ) with check (
          profile_id in (select id from profiles where account_id = auth.uid())
        )
    $p$, t, t);
  end loop;
end $$;
