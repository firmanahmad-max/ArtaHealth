-- ArtaHealth · Migration 0014 · Pengingat sahur (Fase 3 · RM-3d)
-- Menambah 'sahur' ke daftar kind reminder_log agar dedup sekali-per-hari
-- berlaku juga untuk pengingat sahur (send-reminders fasting-aware).
-- Murni relaksasi constraint — tak ada data/skema baru. Inert sampai Edge
-- Function di-deploy & flag Ramadan nyala.

alter table reminder_log drop constraint reminder_log_kind_check;
alter table reminder_log add constraint reminder_log_kind_check
  check (kind in ('hydration','habit','sleep','sahur'));
