# Deploy & Dogfood Checklist — ArtaHealth Fase 1

> Panduan operasional untuk membawa Fase 1 (Sprint 1–6) dari kode ke produksi,
> lalu ke gerbang keluar (dogfood 7 hari). Urutkan dari atas — beberapa langkah
> saling bergantung. Semua kode sudah selesai & CI hijau; yang di sini adalah
> hal yang **butuh kunci/akses eksternal** dan tidak bisa diotomatiskan dari repo.

Legenda: ⬜ belum · ✅ selesai · 🔑 butuh kredensial · ⚠️ mudah terlewat

---

## 0. Prasyarat kredensial (kumpulkan dulu)

- 🔑 ⬜ **Supabase project** (region Singapura terdekat ke Indonesia) — dapatkan `project-ref`, `anon key`, `service_role key`, `project URL`
- 🔑 ⬜ **Sumopod API** — `SUMOPOD_API_KEY` + `SUMOPOD_BASE_URL` (endpoint OpenAI-compatible)
- 🔑 ⬜ **VAPID keypair** untuk Web Push:
  ```bash
  npx web-push generate-vapid-keys
  ```
  Simpan `Public Key` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `Private Key` → `VAPID_PRIVATE_KEY`
- 🔑 ⬜ **Google OAuth Client** (Google Cloud Console → OAuth consent + Credentials) — `Client ID` + `Client Secret`
- 🔑 ⬜ **Sentry project** (Next.js) — `NEXT_PUBLIC_SENTRY_DSN`
- ⬜ **Vercel project** tertaut ke repo `firmanahmad-max/ArtaHealth`

---

## 1. Merge kode ke `main`

- ⬜ Review & merge [PR #2](https://github.com/firmanahmad-max/ArtaHealth/pull/2) (Sprint 3–4)
- ⬜ Review & merge [PR #3](https://github.com/firmanahmad-max/ArtaHealth/pull/3) (Sprint 5–6) — **merge #2 dulu** agar diff bersih
- ⚠️ ⬜ Setelah merge, jalankan CI di `main`: `gh workflow run CI --ref main` (event trigger push masih mati — lihat catatan di bawah)

## 2. Database & migrasi

- ⬜ `supabase link --project-ref <ref>`
- ⬜ `supabase db push` — menjalankan migrasi **0001–0009**
- ⬜ Verifikasi RLS aktif di semua tabel:
  ```sql
  select tablename, rowsecurity from pg_tables
  where schemaname = 'public' order by tablename;
  ```
  Semua harus `rowsecurity = true`.
- ⚠️ ⬜ Konfirmasi ekstensi hidup: `pg_cron`, `pg_net`, `pgcrypto` (dibuat migrasi 0005)

## 3. Vault secrets (untuk cron → Edge Function)

Di **SQL Editor** Supabase (jangan commit nilainya):

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```

- ⬜ `project_url` dibuat
- ⬜ `service_role_key` dibuat
- ⚠️ ⬜ Uji: `select decrypted_secret from vault.decrypted_secrets where name = 'project_url';` mengembalikan nilai

## 4. Auth (Supabase → Authentication)

- ⬜ **Google provider**: aktifkan, isi Client ID + Secret
- ⚠️ ⬜ **Email OTP**: pastikan "Enable Email provider" + OTP (bukan hanya magic link)
- ⬜ **URL Configuration**:
  - Site URL: `https://<domain-produksi>`
  - Redirect allowlist: tambahkan `https://<domain-produksi>/auth/callback` **dan** `http://localhost:3000/auth/callback` (dev)
- ⚠️ ⬜ Di Google Cloud Console, tambahkan Authorized redirect URI Supabase: `https://<ref>.supabase.co/auth/v1/callback`

## 5. Edge Functions

Supabase menyuntik otomatis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — **tidak perlu** di-set manual. Yang perlu diisi hanya secret kustom:

```bash
supabase secrets set \
  SUMOPOD_API_KEY=<...> \
  SUMOPOD_BASE_URL=<...> \
  VAPID_PUBLIC_KEY=<...> \
  VAPID_PRIVATE_KEY=<...> \
  VAPID_SUBJECT=mailto:halo@artahealth.id
# opsional: AI_MODEL=<model>  (default gpt-4o-mini)
```

Deploy ketiga fungsi:

```bash
supabase functions deploy ai-gateway
supabase functions deploy daily-score
supabase functions deploy send-reminders
```

- ⬜ `ai-gateway` deployed
- ⬜ `daily-score` deployed
- ⬜ `send-reminders` deployed
- ⚠️ ⬜ `VAPID_PUBLIC_KEY` di secrets Edge Function **harus sama persis** dengan `NEXT_PUBLIC_VAPID_PUBLIC_KEY` di client, atau push ditolak

## 6. Cron aktif

Migrasi 0005 & 0009 sudah menjadwalkan job. Verifikasi:

```sql
select jobname, schedule, active from cron.job;
```

- ⬜ `daily-scores-hourly` — `59 * * * *`, active
- ⬜ `send-reminders-hourly` — `5 * * * *`, active

## 7. Frontend (Vercel)

Set environment variables (Production + Preview):

| Variabel | Sumber |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key |

- ⬜ Env di-set di Vercel
- ⚠️ ⬜ **JANGAN** memasukkan `SERVICE_ROLE`, `SUMOPOD_API_KEY`, atau `VAPID_PRIVATE_KEY` ke Vercel/client — itu hanya untuk Edge Function
- ⬜ Deploy; PWA hanya aktif di build produksi (service worker mati saat `next dev`)

---

## 8. Smoke test end-to-end (WAJIB sebelum dogfood)

Ini pertama kalinya jalur ke model & push nyata dijalankan — semua sebelumnya baru terverifikasi di lapisan deterministik.

- ⬜ **Auth**: login Google + login email OTP → mendarat di `/onboarding` lalu `/`
- ⬜ **Onboarding**: isi data + goal + consent (health_data_processing wajib) → tersimpan
- ⬜ **Quick-log**: catat air, tidur, aktivitas, mood, berat — muncul di Timeline
- ⬜ **Sync 2 arah**: log di device A → muncul di device B setelah login (pull-sync)
- ⬜ **Offline**: matikan jaringan, catat air, reload → data bertahan; buka `/timeline` (app shell)
- ⬜ **Daily Insight**: panggil manual untuk cek jalur AI nyata:
  ```bash
  curl -X POST 'https://<ref>.supabase.co/functions/v1/daily-score?force=1' \
    -H "Authorization: Bearer <service-role-key>"
  ```
  lalu buka Beranda → InsightCard terisi (source `ai`, bukan `fallback`)
- ⬜ **AI Chat — jalur normal**: tanya "berapa target minum saya?" → jawaban relevan, kuota berkurang
- 🚨 ⬜ **AI Chat — red flag (uji keselamatan paling penting)**: kirim "dada saya nyeri dan sesak napas" → muncul panduan **119** + "berhenti menganalisis", kuota **tidak** berkurang. Ulangi **saat offline** → tetap muncul.
- ⬜ **Push**: aktifkan "Ingatkan saya" di Beranda (izin diberikan) → picu `send-reminders` manual dengan hidrasi di bawah target sore hari → notifikasi personal masuk
- ⬜ **Guard output**: minta chat menyarankan obat → jawaban diblokir jadi template aman

## 9. Monitoring

- ⬜ Sentry menerima event (picu error uji)
- ⚠️ ⬜ Konfirmasi **tidak ada data kesehatan** di payload Sentry/log (CONTEXT §3 aturan 5) — cek breadcrumb & tag
- ⬜ Cek log Edge Function di dashboard: red-flag hanya mencatat kategori, bukan kalimat user

---

## 10. Gerbang keluar Fase 1 (dogfood — CONTEXT §6)

Mulai setelah §8 & §9 hijau. Target 7 hari berturut memakai aplikasi sebagai user nyata.

- ⬜ **Dogfood 7 hari**: pakai setiap hari — log pagi/siang/malam, biarkan skor harian & insight terbentuk, terima pengingat
- ⬜ **Zero critical Sentry 1 minggu**: tidak ada error `critical` selama 7 hari
- ⬜ **Log air < 2 detik**: dari buka app → air tercatat (ukur di device nyata, bukan emulator)
- ⬜ **`daily_scores` terisi**: setelah lewat tengah malam lokal, ada baris skor untuk hari sebelumnya
- ⬜ **Streak jalan**: centang habit beberapa hari → streak naik; lewati sehari → tidak menghukum berlebihan
- ⬜ **Insight tidak halusinasi**: angka di insight cocok dengan data nyata; delta skor benar

### Checklist harian dogfood (salin per hari)

```
Hari __ / 7 — tanggal ______
[ ] Log air ≥3×  [ ] Tidur  [ ] Aktivitas  [ ] Mood  [ ] Habit
[ ] Health Score muncul & masuk akal
[ ] Daily Insight relevan (bukan fallback generik)
[ ] Pengingat push diterima & personal
[ ] Sentry: 0 critical
[ ] Catatan bug/gesekan: __________________________
```

---

## Catatan operasional

- **CI event trigger mati**: push/PR belum memicu CI otomatis (residu suspensi billing GitHub lampau). Picu manual: `gh workflow run CI --ref <branch>`. Cek berkala apakah sudah pulih.
- **Repo public**: dijadikan public untuk membuka GitHub Actions gratis. Bila billing private sudah beres & privasi diinginkan, bisa dikembalikan ke private (`gh repo edit --visibility private`).
- **Uji cron tanpa menunggu**: `daily-score` terima `?force=1` untuk menghitung semua profil tanpa menunggu jam 23 lokal. `send-reminders` mengikuti jam lokal & jam istirahat — uji di sore hari dengan target hidrasi belum tercapai.
- **Rollback**: migrasi bersifat maju-saja (soft delete, bukan drop). Untuk membatalkan cron: `select cron.unschedule('daily-scores-hourly');`.
