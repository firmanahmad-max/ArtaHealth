-- ArtaHealth · Migration 0024 · Mode Konsultasi berbagi (V3-1 · MK-2)
-- Snapshot laporan konsultasi TERENKRIPSI untuk dibagikan ke dokter via link/QR
-- ber-TTL & bisa dicabut. Data = T1 sensitif (CONTEXT §3.5): payload disimpan sebagai
-- ciphertext (AES-GCM, kunci = secret Edge Function CONSULTATION_ENC_KEY) — DB tak
-- pernah menyimpan plaintext kesehatan. `token` acak tak-tertebak = kapabilitas akses
-- publik read-only (dibaca via Edge Function `consultation-view` service-role).
--
-- BUKAN tabel sync (server-side saja) → TIDAK masuk SYNC_TABLES / Dexie.
-- Di belakang flag NEXT_PUBLIC_FEATURE_CONSULTATION + GERBANG privasi (roadmap-v3 §6.8).

create table consultation_reports (
  token       text primary key,        -- acak (hex) — kapabilitas akses publik
  profile_id  uuid not null references profiles(id) on delete cascade,
  ciphertext  text not null,           -- laporan JSON terenkripsi (AES-GCM, base64)
  iv          text not null,           -- nonce (base64)
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,    -- kedaluwarsa (TTL pendek)
  revoked_at  timestamptz              -- dicabut manual → tak bisa dibuka lagi
);
create index idx_consultation_reports_profile on consultation_reports (profile_id, created_at);
create index idx_consultation_reports_expires on consultation_reports (expires_at);

alter table consultation_reports enable row level security;

-- Pemilik akun: kelola snapshot miliknya (buat via Edge Function ber-JWT user → RLS
-- enforce kepemilikan; cabut/lihat daftar dari klien bila perlu). Pembacaan PUBLIK
-- read-only lewat Edge Function service-role (bypass RLS, hanya baris token persis).
create policy "own_consultation_reports" on consultation_reports
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );
