-- ArtaHealth · Migration 0019 · Sadar Gizi — kartu alergi per-profil (Fase 4 · NG-4)
-- Sumber: docs/addendum-sadar-gizi.md §6. Menyimpan alergen yang dipantau pengguna
-- (Big-9 + kustom) + catatan darurat. Basis deteksi alergen pada `ingredients_raw`
-- hasil pindai. Satu kartu per profil (pola fasting_settings, kunci = profile_id).
-- Offline-first (updated_at pull-sync + tombstone). Di belakang feature flag.
--
-- CATATAN KESELAMATAN: app MENANDAI kemungkinan, tidak menjamin "bebas alergen".
-- Daftar sinonim & teks wajib review ahli gizi/alergi sebelum flag nyala (§11).

create table allergy_cards (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  -- [{key,label,terms?,severity?('mild'|'severe'),custom?}]
  allergens   jsonb not null default '[]'::jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_allergy_cards_updated on allergy_cards (profile_id, updated_at);

create trigger trg_allergy_cards_updated_at
  before update on allergy_cards for each row execute function set_updated_at();

alter table allergy_cards enable row level security;
create policy "own_allergy_cards" on allergy_cards
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
