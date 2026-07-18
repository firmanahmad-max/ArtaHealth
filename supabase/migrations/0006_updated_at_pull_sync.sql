-- ArtaHealth · Migration 0006 · updated_at untuk pull-sync inkremental
-- Client menarik perubahan dengan kursor `updated_at > lastPulled` per tabel
-- (lihat apps/web/lib/sync.ts). Trigger menjamin nilainya selalu naik saat UPDATE
-- (termasuk tombstone deleted_at dari perangkat lain).

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['hydration_logs','sleep_logs','activity_logs','weight_logs','mood_logs'] loop
    execute format('alter table %I add column updated_at timestamptz not null default now()', t);
    execute format(
      'create trigger trg_%s_updated_at before update on %I for each row execute function set_updated_at()',
      t, t
    );
    -- index melayani query pull: profile_id = ? and updated_at > ? order by updated_at
    execute format('create index idx_%s_profile_updated on %I (profile_id, updated_at)', t, t);
  end loop;
end $$;
