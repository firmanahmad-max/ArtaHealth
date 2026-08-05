-- ArtaHealth · Migration 0007 · Habit sync (Sprint 5-6)
-- Melengkapi habits & habit_completions agar ikut sync dua arah:
-- updated_at (kursor pull, pola migration 0006) + deleted_at tombstone untuk
-- habit_completions (toggle uncheck harus terpropagasi antar perangkat).
-- Idempotensi completion: client_id stabil per (habit, tanggal) = "<habit_id>:<date>".

alter table habit_completions add column deleted_at timestamptz;

do $$
declare t text;
begin
  foreach t in array array['habits','habit_completions'] loop
    execute format('alter table %I add column updated_at timestamptz not null default now()', t);
    execute format(
      'create trigger trg_%s_updated_at before update on %I for each row execute function set_updated_at()',
      t, t
    );
    execute format('create index idx_%s_profile_updated on %I (profile_id, updated_at)', t, t);
  end loop;
end $$;
