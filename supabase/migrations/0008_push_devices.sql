-- ArtaHealth · Migration 0008 · Push devices & log pengingat
-- Menyimpan langganan Web Push per perangkat + catatan pengingat terkirim
-- (dipakai untuk dedup harian per kategori — lihat buildReminder di packages/core).

create table push_devices (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  -- endpoint unik per langganan browser; dipakai sebagai kunci idempotensi
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  -- diisi saat push ditolak permanen (410 Gone) → berhenti mengirim
  revoked_at   timestamptz
);
create index idx_push_devices_profile on push_devices (profile_id) where revoked_at is null;

-- Satu baris per (profil, tanggal lokal, kategori) menegakkan "maksimal sekali
-- per kategori per hari" di level database, bukan hanya di kode.
create table reminder_log (
  profile_id uuid not null references profiles(id) on delete cascade,
  date       date not null,
  kind       text not null check (kind in ('hydration','habit','sleep')),
  sent_at    timestamptz not null default now(),
  primary key (profile_id, date, kind)
);

alter table push_devices enable row level security;
alter table reminder_log enable row level security;

create policy "own_push_devices" on push_devices
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );

-- User boleh melihat riwayat pengingatnya; penulisan hanya via service_role.
create policy "own_reminder_log_read" on reminder_log
  for select using (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
