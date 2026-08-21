-- ArtaHealth · Migration 0022 · Medical Vault OCR (Fase 6 #1 · MV-3)
-- Sumber: addendum-silent-killer.md §2.5. Upload foto hasil lab → OCR → nilai masuk
-- biomarker_readings dengan source='vault_ocr' + tautan ke dokumen asal.
--
-- ⚠️ biomarker_readings LIVE di produksi. Kolom baru ADD IF NOT EXISTS (aman). Klien
-- hanya mengirim source/vault_doc_id bila di-set (baris manual lama tak terpengaruh).
-- WAJIB db-push sebelum fitur Vault dipakai (flag NEXT_PUBLIC_FEATURE_VAULT nyala).

-- Dokumen medis (Vault) — metadata + nilai terekstrak. Foto opsional (Storage, MVP null).
create table medical_documents (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  kind         text not null default 'lab',           -- lab|resep|radiologi|lainnya
  doc_date     date,                                    -- tanggal pemeriksaan bila terbaca
  extracted    jsonb,                                   -- nilai OCR final (pasca koreksi)
  photo_path   text,                                    -- Supabase Storage (opsional)
  scanned_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index idx_med_docs_profile_time on medical_documents (profile_id, scanned_at desc);
create index idx_med_docs_profile_updated on medical_documents (profile_id, updated_at);

create trigger trg_medical_documents_updated_at
  before update on medical_documents for each row execute function set_updated_at();

alter table medical_documents enable row level security;
create policy "own_medical_documents" on medical_documents
  for all using (
    profile_id in (select id from profiles where account_id = auth.uid())
  ) with check (
    profile_id in (select id from profiles where account_id = auth.uid())
  );

-- Jejak asal pembacaan biomarker (dari OCR Vault). Aman utk data manual yang sudah ada.
alter table biomarker_readings add column if not exists source text not null default 'manual';
alter table biomarker_readings add column if not exists vault_doc_id uuid references medical_documents(id) on delete set null;
