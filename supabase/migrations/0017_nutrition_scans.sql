-- ArtaHealth · Migration 0017 · Sadar Gizi — scan & food log (Fase 4 · NG-3)
-- Sumber: docs/addendum-sadar-gizi.md §5. Riwayat pemindaian + food_logs (basis
-- akumulasi GGL Budget harian). Verdict disimpan bersama versinya (bisa dijelaskan
-- walau ambang diperbarui — pola biomarker_readings.classification).
-- Offline-first (updated_at pull-sync + tombstone). Di belakang feature flag.

create table product_scans (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,   -- profil TARGET verdict
  scanned_by    uuid references profiles(id) on delete set null,
  product_name  text,
  food_form     text not null default 'solid' check (food_form in ('solid','beverage')),
  photo_path    text,                       -- null utk entri manual
  extracted     jsonb not null,             -- hasil ekstraksi final (pasca koreksi user)
  user_corrected boolean not null default false,
  verdict       jsonb not null,             -- {overall, perNutrient, budgetImpact, bandsVersion,...}
  scanned_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_scans_profile_time on product_scans (profile_id, scanned_at desc);
create index idx_scans_profile_updated on product_scans (profile_id, updated_at);

create table food_logs (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  name          text,
  meal_type     text not null default 'camilan'
                check (meal_type in ('sarapan','siang','malam','camilan','sahur','iftar')),
  -- nutrien GGL utk akumulasi anggaran harian (sekemasan/porsi yang dikonsumsi)
  sugar_g       numeric,
  sodium_mg     numeric,
  fat_g         numeric,
  energy_kcal   numeric,
  source_scan_id uuid references product_scans(id) on delete set null,
  logged_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_food_logs_profile_time on food_logs (profile_id, logged_at desc);
create index idx_food_logs_profile_updated on food_logs (profile_id, updated_at);

create trigger trg_product_scans_updated_at
  before update on product_scans for each row execute function set_updated_at();
create trigger trg_food_logs_updated_at
  before update on food_logs for each row execute function set_updated_at();

-- ===== RLS =====
alter table product_scans enable row level security;
alter table food_logs enable row level security;

create policy "own_product_scans" on product_scans
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );

create policy "own_food_logs" on food_logs
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
