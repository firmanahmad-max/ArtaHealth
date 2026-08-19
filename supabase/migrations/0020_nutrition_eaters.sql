-- ArtaHealth · Migration 0020 · Sadar Gizi — "Pindai untuk siapa" (Fase 4 · NG-4b)
-- Sumber: docs/addendum-sadar-gizi.md §6 (multi-profil ringan). Anggota rumah yang
-- dipindaikan (anak/orang tua/pasangan) — persona gizi ringan: nama + relasi +
-- kondisi (untuk anggaran & nutrien utama) + alergen (untuk deteksi bahan). Verdict &
-- alert alergen dihitung ulang per orang yang dipilih. Milik profil pemilik akun
-- (bukan rearsitektur profiles global; "Saya" tetap pakai monitored_conditions +
-- allergy_cards). Offline-first + tombstone. Di belakang feature flag.
--
-- CATATAN: lemari (saved_products) tetap berbagi di profil pemilik → efektif dipakai
-- bersama semua orang yang dipindai. RLS per profil pemilik.

create table nutrition_eaters (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,   -- pemilik akun
  name        text not null,
  relation    text,                        -- 'anak' | 'orang_tua' | 'pasangan' | 'lainnya'
  conditions  jsonb not null default '[]'::jsonb,   -- ['hypertension'|'diabetes'|'dyslipidemia'|'gout']
  allergens   jsonb not null default '[]'::jsonb,   -- [{key,label,terms?,custom?}]
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index idx_eaters_profile_updated on nutrition_eaters (profile_id, updated_at);

create trigger trg_nutrition_eaters_updated_at
  before update on nutrition_eaters for each row execute function set_updated_at();

alter table nutrition_eaters enable row level security;
create policy "own_nutrition_eaters" on nutrition_eaters
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
