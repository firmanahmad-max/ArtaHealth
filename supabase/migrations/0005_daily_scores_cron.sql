-- ArtaHealth · Migration 0005 · Cron daily_scores
-- Menjadwalkan Edge Function `daily-score` tiap jam menit :59.
-- Fungsi memfilter profil yang jam LOKAL-nya 23 (profiles.timezone),
-- sehingga skor final tertulis pukul 23:59 waktu masing-masing user (CONTEXT §6).
--
-- PRASYARAT sekali per project (SQL Editor, JANGAN di-commit):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- Lalu deploy fungsinya: supabase functions deploy daily-score

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- idempoten: buang jadwal lama bila migration dijalankan ulang di project baru
do $$
begin
  perform cron.unschedule('daily-scores-hourly');
exception when others then
  null; -- belum pernah terjadwal
end $$;

select cron.schedule(
  'daily-scores-hourly',
  '59 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/daily-score',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
