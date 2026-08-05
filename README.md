# ArtaHealth

AI Personal Health Companion — PWA untuk pasar Indonesia.
**Baca `CONTEXT.md` sebelum menulis kode apa pun.** Dokumen lengkap: `/docs`.

## Quickstart (Sprint 1)

```bash
# 1. Prasyarat: Node 20+, pnpm 9+, Supabase CLI
pnpm install

# 2. Supabase
supabase init            # sekali saja (folder sudah ada, cukup link)
supabase link --project-ref <ref-project-anda>
supabase db push         # menjalankan migrations/0001..0005
supabase functions deploy daily-score   # cron skor harian (lihat catatan di 0005)
# Sekali per project, via SQL Editor (untuk pg_cron → Edge Function):
#   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
#   select vault.create_secret('<service-role-key>', 'service_role_key');

# 3. Env
cp .env.example apps/web/.env.local   # isi nilai dari dashboard Supabase

# 4. Jalankan
pnpm dev                 # http://localhost:3000

# 5. Test (scoring engine wajib hijau sebelum commit)
pnpm test
```

## Struktur

```
apps/web                 Next.js 14 App Router (PWA)
packages/core            Rule engines + Zod schemas (unit test 100% utk engine)
packages/design-system   Token + komponen inti (HealthRing dkk.)
supabase/migrations      DDL + RLS (satu-satunya cara ubah schema)
docs/                    Seluruh dokumen produk & teknis
```

## Fase saat ini: FASE 1 (V1 Fondasi)
Scope tepat ada di `CONTEXT.md` §6 dan `docs/master-roadmap.md`. Fitur di luar itu → backlog, bukan kode.
