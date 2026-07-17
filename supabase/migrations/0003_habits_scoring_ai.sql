-- ArtaHealth · Migration 0003 · Habits, Scoring (read-model), AI, Billing, Flags
-- Sumber: docs/technical-blueprint.md §3.2 — Fase 1

create table habits (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  name         text not null check (char_length(name) between 1 and 80),
  icon         text,
  target_type  text not null default 'boolean' check (target_type in ('boolean','count','duration')),
  target_value int check (target_value between 1 and 1000),
  schedule     jsonb not null default '{"days":[1,2,3,4,5,6,7]}',
  tags         text[] not null default '{}',   -- mis. 'fasting_incompatible' (dipakai Fase 3)
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index idx_habits_profile on habits (profile_id) where deleted_at is null and is_active;

create table habit_completions (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references habits(id) on delete cascade,
  profile_id  uuid not null references profiles(id),
  date        date not null,
  value       int not null default 1 check (value >= 0),
  client_id   text not null,
  unique (habit_id, date),
  unique (profile_id, client_id)
);
create index idx_habit_completions_profile_date on habit_completions (profile_id, date desc);

-- Read-model skor harian (final ditulis Edge Function via pg_cron 23:59 waktu lokal user)
create table daily_scores (
  profile_id     uuid not null references profiles(id),
  date           date not null,
  health_score   smallint not null check (health_score between 0 and 100),
  breakdown      jsonb not null,
  computed_at    timestamptz not null default now(),
  primary key (profile_id, date)
);

create table ai_insights (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  insight_type text not null check (insight_type in ('daily','weekly','correlation','alert')),
  content      text not null,
  data_context jsonb,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index idx_insights_profile on ai_insights (profile_id, created_at desc);
-- satu daily insight per profil per hari (cache — Blueprint §5.1)
create unique index uq_daily_insight on ai_insights (profile_id, insight_type, (created_at::date))
  where insight_type = 'daily';

create table ai_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  session_id   uuid not null,
  role         text not null check (role in ('user','assistant')),
  content      text not null,
  token_count  int,
  created_at   timestamptz not null default now()
);
create index idx_chat_session on ai_chat_messages (session_id, created_at);
create index idx_chat_profile_day on ai_chat_messages (profile_id, (created_at::date)); -- kuota harian free

create table subscriptions (
  account_id   uuid primary key references auth.users(id) on delete cascade,
  tier         text not null default 'free' check (tier in ('free','pro')),
  valid_until  timestamptz,
  provider     text check (provider in ('midtrans','manual','playstore')),
  updated_at   timestamptz not null default now()
);

create table feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

-- ===== RLS =====
do $$
declare t text;
begin
  foreach t in array array['habits','habit_completions','daily_scores','ai_insights','ai_chat_messages'] loop
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

alter table subscriptions enable row level security;
create policy "own_subscription_read" on subscriptions
  for select using (account_id = auth.uid());
-- tulis subscription hanya via service_role (webhook billing)

alter table feature_flags enable row level security;
create policy "flags_read_all" on feature_flags for select using (true);
-- tulis flags hanya via service_role
