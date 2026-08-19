-- ArtaHealth · Migration 0018 · Sadar Gizi — lemari produk tersimpan (Fase 4 · NG-3b)
-- Sumber: docs/addendum-sadar-gizi.md §5. "Lemari" produk yang sering dikonsumsi:
-- muat ulang cepat + bahan Pindai Pembanding. extracted = NutritionInput (camelCase,
-- sama seperti product_scans) → verdict dihitung ulang client-side dengan kondisi kini.
--
-- CATATAN: addendum menyebut cabinet account-level; di sini di-SCOPE per-profil agar
-- konsisten dengan arsitektur sync (pull by profile_id). Berbagi lemari antar-profil
-- satu akun → NG-4 (multi-profil). Offline-first + tombstone. Di belakang feature flag.

create table saved_products (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  product_name  text not null,
  food_form     text not null default 'solid' check (food_form in ('solid','beverage')),
  extracted     jsonb not null,             -- NutritionInput (nilai gizi ternormalisasi)
  last_verdict  jsonb,                       -- verdict terakhir (cache tampil cepat)
  scan_count    integer not null default 1,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_saved_products_profile_updated on saved_products (profile_id, updated_at);
create index idx_saved_products_profile_name on saved_products (profile_id, lower(product_name));

create trigger trg_saved_products_updated_at
  before update on saved_products for each row execute function set_updated_at();

alter table saved_products enable row level security;
create policy "own_saved_products" on saved_products
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
