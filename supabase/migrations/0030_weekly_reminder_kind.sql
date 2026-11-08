-- ArtaHealth · Migration 0030 · Jenis pengingat 'weekly' (push Ringkasan Mingguan, Fase 8 KR-5)
-- reminder_log (PK profile_id+date+kind) menjadi dedup "sekali per minggu": baris 'weekly' pada
-- tanggal Minggu tsb. Tanpa nilai ini, insert klaim ditolak CHECK → push tak terkirim (pola 0014/0027).

alter table reminder_log drop constraint if exists reminder_log_kind_check;
alter table reminder_log add constraint reminder_log_kind_check
  check (kind in ('hydration','habit','sleep','sahur','iftar','weekly'));
