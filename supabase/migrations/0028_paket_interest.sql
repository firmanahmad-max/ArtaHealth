-- ArtaHealth · Migration 0028 · Validasi minat Paket Ramadan (Fase 9 · RW-4a)
-- Satu baris per profil: opsi paket yang diminati (atau "belum perlu"). TANPA pembayaran & TANPA
-- data kesehatan — hanya pilihan + waktu. Dipakai menghitung minat (gerbang master-roadmap §5)
-- lewat agregat SQL oleh pemilik. Inert sampai flag NEXT_PUBLIC_FEATURE_PAKET_INTEREST nyala.

create table paket_interest (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  choice      text not null check (choice in ('season','season_syawal','pro_annual','not_now')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_paket_interest_updated_at
  before update on paket_interest for each row execute function set_updated_at();

alter table paket_interest enable row level security;
create policy "own_paket_interest" on paket_interest
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
