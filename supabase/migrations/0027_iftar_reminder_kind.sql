-- ArtaHealth · Migration 0027 · Pengingat berbuka/iftar (Fase 9 · RW-5)
-- Menambah 'iftar' ke daftar kind reminder_log agar dedup sekali-per-hari-per-profil berlaku
-- untuk pengingat berbuka (send-reminders, pola sama dgn 'sahur' di 0014). Inert sampai Mode
-- Ramadan aktif + fungsi send-reminders di-deploy. Non-medis.

alter table reminder_log drop constraint reminder_log_kind_check;
alter table reminder_log add constraint reminder_log_kind_check
  check (kind in ('hydration','habit','sleep','sahur','iftar'));
