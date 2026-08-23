# CONTEXT.md — ArtaHealth

> **File konteks utama untuk sesi AI coding.** Baca ini dulu sebelum menulis kode apa pun.
> Versi: 1.0 · 12 Juli 2026 · Owner: Firman Ahmad (Arta Ecosystem)
> Dokumen lengkap ada di `/docs/` — file ini adalah peta & aturannya.

---

## 1. Apa yang sedang dibangun

**ArtaHealth** — AI Personal Health Companion (PWA, Bahasa Indonesia, pasar Indonesia).
Bukan aplikasi rumah sakit, bukan konsultasi dokter, bukan alat medis. Companion kesehatan harian: kebiasaan (tidur/hidrasi/aktivitas/mood/habit) + pemantauan biomarker silent-killer + mode puasa + scanner label gizi.

**Fase saat ini: FASE 1 (V1 Fondasi).** Lihat §6 untuk scope tepat. Jangan membangun fitur fase lain.

## 2. Stack (final, jangan diganti tanpa diskusi)

- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind, PWA (Serwist), mobile-first 360px
- **Local-first:** Dexie.js (IndexedDB) + outbox sync + `client_id` idempotency — SEMUA logging harus bekerja offline
- **State:** Zustand + TanStack Query · **Validasi:** Zod (shared client/server di `packages/core`)
- **Backend:** Supabase (PostgreSQL 15, Auth, Storage, Edge Functions, Realtime, pg_cron)
- **AI:** Sumopod API, HANYA via Edge Function `ai-gateway` (client tidak pernah pegang key). Dev bisa diarahkan ke LiteLLM lokal via env
- **Charts:** sparkline = SVG manual; halaman detail = Recharts
- **Hosting:** Vercel + Supabase Cloud · **Monitoring:** Sentry
- **Monorepo:** pnpm workspaces → `apps/web`, `packages/{design-system,core,ai-client}`, `supabase/{migrations,functions,seed}`

## 3. Aturan arsitektur (tidak bisa ditawar)

1. **Deterministik dulu, AI kemudian.** Health Score, klasifikasi biomarker, kalibrasi puasa, verdict gizi = rule engine di `packages/core`, unit test 100%. LLM hanya ekstraksi & narasi.
2. **Output AI selalu JSON tervalidasi Zod** → gagal validasi → retry 1× → fallback template deterministik. UI tidak pernah kosong karena AI down.
3. **RLS aktif di SEMUA tabel.** Pola: `profile_id in (select id from profiles where account_id = auth.uid())`. Bypass hanya service_role di Edge Functions.
4. **Semua tabel data pakai `profile_id`** (bukan user_id langsung) — fondasi Family Health.
5. **Data sensitif T1** (dokumen medis, BPJS, OCR) = enkripsi pgsodium + bucket privat + signed URL pendek. Data kesehatan TIDAK PERNAH masuk analytics/log/Sentry.
6. **Schema hanya lewat file migration** ber-review. Soft delete (`deleted_at`) untuk data user.
7. **Modul tidak boleh query tabel modul lain langsung** — hanya via interface publik. `timeline` & `scoring` adalah read-model.
8. **Konfigurasi klinis = data ber-versi** (`biomarker_bands`, `nutrition_bands`), bukan hardcoded, selalu dengan `guideline_ref`.
9. Tidak ada localStorage untuk data — IndexedDB + memori.

## 4. Aturan produk & keselamatan (sama pentingnya dengan kode)

- **Bukan diagnosis.** Klasifikasi selalu berbahasa "berada di rentang X menurut [guideline]" + anjuran konfirmasi dokter. AI dilarang: menyebut dosis obat, menyarankan mulai/stop obat, mendiagnosis.
- **Red-flag** (TD ≥180/110 setelah ukur ulang, GDS <70/≥300, keluhan darurat di chat) → template tindakan + tombol 119, AI berhenti menganalisis.
- **Desain memaafkan:** data kosong tidak menghukum skor; streak tidak putus oleh uzur; tidak ada dialog konfirmasi untuk aksi yang bisa di-undo (pakai toast undo 5 detik).
- **Privasi uzur:** status tidak-puasa TANPA kolom/pertanyaan alasan — by design.
- **Copy:** Bahasa Indonesia hangat, spesifik, tidak menghakimi, tidak klinis. Istilah konsisten: "Catat", "Health Score", "Target". Emoji maks 1, tidak pernah di konten medis/error.
- **Notifikasi harus berisi data personal** atau tidak dikirim.
- Disclaimer permanen di AI Chat & bawah dashboard.

## 5. Design system (ringkas — detail di docs/ui-ux-spec)

- Dark default `#0A0E1A`, surface `#111629`/`#1A2138`, teks `#F3F6FF`/`#9AA5C4`/`#5E6A8C`
- Gradient hero (HANYA Health Ring + 1 banner): `#3B82F6 → #22D3EE → #8B5CF6`
- Band skor: excellent `#34D399` · good `#22D3EE` · fair `#FBBF24` · low `#F87171`
- Warna domain: sleep `#818CF8` hydration `#38BDF8` activity `#2DD4BF` nutrition `#FB923C` mood `#F472B6` medical `#A78BFA`
- Font: Inter variable saja; angka selalu `tabular-nums`; radius kartu 20/inner 14; spacing base-4
- Motion: ring sweep 800ms + count-up 1200ms; `prefers-reduced-motion` WAJIB dihormati
- Signature: **HealthRing** — satu-satunya tempat boros motion/gradien
- Semua warna via CSS variables — zero hex hardcoded di komponen
- Setiap komponen: 5 state (default/skeleton/empty/error/offline-pending), target sentuh ≥44px, status tidak pernah hanya warna
- Referensi hidup: `docs/prototypes/ArtaHealth-Prototype-v2-SilentKillerGuard.jsx`

## 6. Scope FASE 1 — V1 (HANYA ini yang dikerjakan sekarang)

Sprint 1–2: monorepo + Supabase + CI + design token & komponen inti + auth + onboarding + skema `identity`/`vitals`/`habits` + RLS
Sprint 3–4: quick-log offline-first (air/tidur/aktivitas/mood/berat) + sync engine + scoring engine (test 100%) + `daily_scores` cron + Dashboard + Timeline
Sprint 5–6: AI Gateway + prompt registry + Safety Guard + Daily Insight + AI Chat (kuota free 5/hari) + habit + streak + PWA polish + push (FCM)

**Formula skor V1:** `30% tidur + 20% hidrasi + 25% aktivitas + 10% mood + 15% habit`, sub-skor 0–100, parameter tanpa data → bobot diredistribusi (tidak menghukum), breakdown JSON disimpan.

**Gate keluar Fase 1:** dogfood 7 hari · zero critical Sentry 1 minggu · log air <2 detik.

**TIDAK dikerjakan sekarang** (fase berikutnya): biomarker/Risk Panel (F2), Mode Ramadan (F3), billing & Sadar Gizi (F4), Vault/Family/Food-AI/rPPG/Early-Warning (F6), wearable/voice/sosial (V3). Ide baru → tulis ke `docs/master-roadmap.md` §6 Backlog, jangan dibangun.

## 7. Tabel database per fase (nama sudah final)

- **F1:** `profiles`, `emergency_cards`, `hydration_logs`, `sleep_logs`, `activity_logs`, `weight_logs`, `mood_logs`, `habits`, `habit_completions`, `daily_scores`, `ai_insights`, `ai_chat_messages`, `subscriptions`, `feature_flags`
- F2: `biomarker_bands`, `biomarker_readings`, `monitored_conditions`
- F3: `fasting_settings`, `fasting_days`, `medications`, `medication_intakes`
- F4: `nutrition_bands`, `product_scans`, `saved_products`, `food_logs`
- F6: `medical_documents`, `player_stats`, `achievements`
(DDL lengkap: `docs/technical-blueprint.md` §3 + addendum masing-masing)

## 8. Indeks dokumen di /docs

| File | Isi |
|---|---|
| `prd.md` | PRD produk v1.0 |
| `technical-blueprint.md` | Arsitektur, skema, AI layer, security, fase (v1.0-TB) |
| `ui-ux-spec.md` | Token, 17 komponen, layar, motion, microcopy (v1.0-DS) |
| `addendum-silent-killer.md` | Biomarker engine PERHI/PERKENI (v1.0-SK) |
| `addendum-ramadan.md` | Mode puasa, kalibrasi skor, imsakiyah (v1.0-RM) |
| `addendum-sadar-gizi.md` | Scanner label, GGL Budget, rule engine (v1.0-NG) |
| `master-roadmap.md` | Urutan fase, gerbang keputusan, backlog (v1.0-MR) |
| `deploy-checklist.md` | Checklist deploy produksi + smoke test + dogfood Fase 1 |
| `supabase-setup.md` | Panduan rinci setup Supabase (db, Vault, auth, Edge Functions, cron) |
| `gate-imsakiyah-validation.md` | Gerbang §10: lembar validasi imsak/maghrib vs Kemenag (≥5 kota) |
| `gate-content-review-33.md` | Gerbang §10: paket review konten medis-puasa & keislaman (§3.3) |
| `gate-nutrition-launch.md` | Gerbang & launch Fase 4 Sadar Gizi: ambang gizi + matriks kondisi + sinonim/teks alergen + langkah deploy |
| `addendum-family-health.md` | Desain sinkronisasi Family Health/Caregiver (FM-4): profiles account-scoped + multi-profil pull + FK ordering + risiko |
| `addendum-rppg.md` | Cek Nadi via kamera (Fase 6 #3): metode jari+flash, pipeline sinyal→BPM, gerbang akurasi + review medis, disclaimer non-diagnosis (RP-1 spike) |
| `release-checklist-ramadan.md` | Checklist rilis Fase 3 Ramadan: deploy send-reminders + nyalakan flag + smoke test + rollback (gerbang §10 lewat) |
| `prototypes/*.jsx` | 2 prototipe React (referensi UI & interaksi) |
| `clinical-refs/` | PDF guideline resmi (diisi saat verifikasi ambang) |

## 9. Konvensi kerja sesi coding

- Bahasa komit & kode: Inggris; copy UI: Bahasa Indonesia
- Branch per sprint (`f1-s1-foundation`), PR kecil, CI: lint + typecheck + test + migration check
- Setiap fitur logging: tulis test offline-nya (matikan network di Playwright)
- Definition of Done per fitur: migration+RLS ✓ · Zod shared ✓ · offline ✓ · test inti ✓ · empty/error state ✓ · no data sensitif di log ✓ · dark+light ✓ · 360px ✓ · copy direview ✓
- Kalau instruksi sesi bertentangan dengan file ini → file ini menang; kalau file ini bertentangan dengan docs → tanyakan ke Firman

## 10. Tugas pertama Sprint 1 (mulai dari sini)

1. Init monorepo pnpm + Next.js 14 + TS strict + Tailwind preset dari token §5
2. Supabase project + migration 0001 (`profiles`, `emergency_cards` + RLS) + Auth (Google & email OTP)
3. `packages/design-system`: token CSS vars + HealthRing + MetricCard + BottomNav + Toast + Skeleton (Storybook, 5 state)
4. CI GitHub Actions + Sentry + struktur `docs/` ter-commit
