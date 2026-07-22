-- ArtaHealth · Migration 0009 · Cron pengingat push
-- Menjadwalkan Edge Function `send-reminders` tiap jam menit :05.
-- Fungsi sendiri yang menentukan jam lokal tiap profil dan apakah ada sesuatu
-- yang personal untuk dikirim — cron hanya memberi detak.
--
-- PRASYARAT (sekali per project, sama seperti migration 0005):
--   vault secrets `project_url` & `service_role_key`
--   env fungsi: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
--   supabase functions deploy send-reminders

do $$
begin
  perform cron.unschedule('send-reminders-hourly');
exception when others then
  null;
end $$;

select cron.schedule(
  'send-reminders-hourly',
  '5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/send-reminders',
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
