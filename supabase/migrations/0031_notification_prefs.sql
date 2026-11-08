-- ArtaHealth · Migration 0031 · Preferensi jenis pengingat (Fase 8 · tindak lanjut retensi)
-- Satu baris per profil: kategori push yang DIBISUKAN pengguna (hydration/habit/sleep/weekly/ramadan;
-- dinormalisasi oleh @arta/core normalizeMuted). Tanpa baris = tak ada yang dibisukan (perilaku lama).
-- send-reminders membaca tabel ini dengan service_role; bila tabel belum ada, server menganggap
-- tak ada yang dibisukan (aman di-deploy sebelum/sesudah db push).

create table notification_prefs (
  profile_id  uuid primary key references profiles(id) on delete cascade,
  muted       text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_notification_prefs_updated_at
  before update on notification_prefs for each row execute function set_updated_at();

alter table notification_prefs enable row level security;
create policy "own_notification_prefs" on notification_prefs
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
