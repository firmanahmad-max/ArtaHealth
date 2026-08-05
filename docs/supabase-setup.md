# Panduan Setup Supabase — ArtaHealth Fase 1

> Detail langkah 2–6 dari [`deploy-checklist.md`](deploy-checklist.md): database,
> Vault, auth, Edge Functions, dan cron. Dibuat spesifik karena beberapa hal di
> sini gampang salah tanpa pesan error yang jelas.
>
> **Baca dulu — dua "secret" yang BERBEDA (sumber kebingungan nomor satu):**
>
> | | Apa | Diisi lewat | Dibaca oleh |
> |---|---|---|---|
> | **Edge Function secrets** | `SUMOPOD_API_KEY`, `VAPID_*`, dll. | `supabase secrets set` / Dashboard → Edge Functions → Secrets | kode fungsi (`Deno.env.get`) |
> | **Vault secrets** | `project_url`, `service_role_key` | SQL Editor (`vault.create_secret`) | SQL cron job saat memanggil fungsi |
>
> Keduanya wajib, tapi mengisi yang satu tidak menggantikan yang lain.

---

## Prasyarat CLI

```bash
# Supabase CLI (macOS/Linux via brew, Windows via scoop/npm)
supabase --version        # butuh >= 1.200 (bundling import lintas folder)
supabase login            # buka browser, tempel access token
```

Dapatkan `project-ref` dari URL dashboard: `https://supabase.com/dashboard/project/<project-ref>`.

---

## Langkah 2 — Database & migrasi

### 2.1 Link project

```bash
cd "D:/Project Apps/ArtaHealth"
supabase link --project-ref <project-ref>
# akan meminta database password (Settings → Database → Connection string)
```

### 2.2 Jalankan migrasi

```bash
supabase db push
```

Ini menjalankan `supabase/migrations/0001_…` s/d `0009_…` berurutan. Yang terjadi:

| Migrasi | Isi penting |
|---|---|
| 0001–0004 | tabel identity/vitals/habits/scoring/AI + onboarding & consents |
| 0005 | **membuat ekstensi `pg_cron`, `pg_net`, `pgcrypto`** + jadwal `daily-scores-hourly` |
| 0006 | `updated_at` + fungsi `set_updated_at()` (dipakai 0007 juga) |
| 0007 | kolom sync habit |
| 0008 | `push_devices`, `reminder_log` |
| 0009 | jadwal `send-reminders-hourly` |

> ⚠️ **pg_cron & pg_net** kadang perlu diaktifkan manual lebih dulu bila project
> menolak `create extension`. Dashboard → Database → Extensions → cari `pg_cron`
> dan `pg_net`, toggle ON, lalu ulangi `supabase db push`.

### 2.3 Verifikasi RLS

Di SQL Editor:

```sql
-- Semua tabel publik HARUS row-level security aktif
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Setiap baris harus `rowsecurity = true`. Bila ada yang `false`, jangan lanjut —
itu berarti data satu user bisa terbaca user lain.

```sql
-- Cek policy terpasang (harus ada 'own_*' di tiap tabel data)
select tablename, policyname from pg_policies
where schemaname = 'public' order by tablename;
```

---

## Langkah 3 — Vault secrets (untuk cron → Edge Function)

Cron job (SQL) memanggil Edge Function lewat HTTP dan butuh URL project + kunci
service_role. Nilai ini **tidak** boleh hardcoded di migrasi, jadi disimpan di Vault.

Di **SQL Editor**:

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```

- `service-role-key` dari Settings → API → `service_role` (secret, bukan `anon`).

Verifikasi:

```sql
select name, decrypted_secret
from vault.decrypted_secrets
where name in ('project_url', 'service_role_key');
```

> Bila salah isi (mis. anon key), cron akan gagal senyap (401 dari fungsi).
> Perbaiki dengan `update vault.secrets ...` atau hapus & buat ulang.

---

## Langkah 4 — Auth

### 4.1 Google OAuth

**Di Google Cloud Console:**
1. APIs & Services → OAuth consent screen → External → isi nama app, email support, domain
2. Credentials → Create OAuth client ID → **Web application**
3. Authorized redirect URIs → tambahkan **URI callback Supabase** (bukan URL app):
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
4. Salin **Client ID** & **Client Secret**

**Di Supabase Dashboard:** Authentication → Providers → Google → aktifkan, tempel Client ID + Secret.

### 4.2 Email OTP

Authentication → Providers → Email → aktifkan. Kode `/login` memakai
`signInWithOtp` + `verifyOtp` (OTP 6 digit), **bukan** magic link.

> ⚠️ Pastikan template email OTP mengirim **kode** (`{{ .Token }}`), bukan hanya
> tautan (`{{ .ConfirmationURL }}`). Authentication → Email Templates → "Magic Link"
> / "OTP" — konfirmasi ada `{{ .Token }}`.

### 4.3 URL Configuration

Authentication → URL Configuration:

- **Site URL**: `https://<domain-produksi>`
- **Redirect URLs** (allowlist) — tambahkan keduanya:
  ```
  https://<domain-produksi>/auth/callback
  http://localhost:3000/auth/callback
  ```

Kode client mengarahkan OAuth ke `${window.location.origin}/auth/callback`
([`apps/web/app/login/page.tsx`](../apps/web/app/login/page.tsx)), jadi origin
mana pun yang dipakai harus ada di allowlist atau login gagal di langkah redirect.

---

## Langkah 5 — Edge Functions

### 5.1 Env var per fungsi (yang harus diisi manual)

Supabase **menyuntik otomatis** `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` ke semua fungsi — jangan set ulang.

Yang harus diisi manual, per fungsi:

| Fungsi | Secret manual | Wajib? |
|---|---|---|
| `ai-gateway` | `SUMOPOD_API_KEY`, `SUMOPOD_BASE_URL` | ya |
| `ai-gateway` | `AI_MODEL` | opsional (default `gpt-4o-mini`) |
| `daily-score` | — (cukup yang auto-inject) | — |
| `send-reminders` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | ya |

Set sekaligus (secret berlaku untuk semua fungsi di project):

```bash
supabase secrets set \
  SUMOPOD_API_KEY='<...>' \
  SUMOPOD_BASE_URL='https://<endpoint-sumopod>/v1' \
  VAPID_PUBLIC_KEY='<...>' \
  VAPID_PRIVATE_KEY='<...>' \
  VAPID_SUBJECT='mailto:halo@artahealth.id'

supabase secrets list   # verifikasi (nilai tersembunyi)
```

> 🚨 `VAPID_PUBLIC_KEY` di sini **harus identik** dengan
> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` di frontend. Beda satu karakter → browser
> menolak langganan push tanpa error yang jelas.
>
> `SUMOPOD_BASE_URL` harus endpoint OpenAI-compatible; fungsi memanggil
> `POST {BASE_URL}/chat/completions`. Sertakan `/v1` bila providernya begitu.

### 5.2 Deploy — dan catatan soal kode bersama

Ketiga fungsi meng-import engine dari `packages/core` lewat path relatif
(`../../../packages/core/src/...`). Saat deploy, Supabase CLI mem-bundle seluruh
graf import fungsi, termasuk file di luar `supabase/functions/`, memakai
`supabase/functions/deno.json` (import map untuk `zod`).

```bash
supabase functions deploy ai-gateway
supabase functions deploy daily-score
supabase functions deploy send-reminders
supabase functions list      # ketiganya harus muncul, status ACTIVE
```

> ⚠️ **Verifikasi bundling** — karena fungsi menarik kode dari luar foldernya,
> jangan anggap deploy sukses = jalan. Uji tiap fungsi (§5.3). Bila bundler
> mengeluh soal import `zod` atau path core, jalankan dengan import map eksplisit:
> ```bash
> supabase functions deploy ai-gateway --import-map supabase/functions/deno.json
> ```

### 5.3 Smoke test tiap fungsi

`daily-score` (aman dipanggil kapan saja, `?force=1` melewati filter jam):

```bash
curl -i -X POST \
  'https://<project-ref>.supabase.co/functions/v1/daily-score?force=1' \
  -H 'Authorization: Bearer <service-role-key>'
# harap: 200 {"processed":N,...}
```

`ai-gateway` butuh **JWT user** (bukan service_role — fungsi menegakkan RLS atas
nama user). Ambil dari sesi login di app (DevTools → Application → Local Storage →
`access_token`) lalu:

```bash
curl -i -X POST \
  'https://<project-ref>.supabase.co/functions/v1/ai-gateway' \
  -H 'Authorization: Bearer <user-access-token>' \
  -H 'Content-Type: application/json' \
  -d '{"useCase":"chat","profileId":"<profile-uuid>","payload":{"message":"halo"}}'
# harap: 200 {"reply":"...", "source":"ai"}  (source "fallback" = provider gagal)
```

`send-reminders` (butuh minimal satu `push_devices` aktif untuk mengirim; tanpa
itu mengembalikan `{"sent":0}`):

```bash
curl -i -X POST \
  'https://<project-ref>.supabase.co/functions/v1/send-reminders' \
  -H 'Authorization: Bearer <service-role-key>'
```

Lihat log real-time saat menguji:

```bash
supabase functions logs ai-gateway --tail
```

> Konfirmasi di log: entri red-flag hanya mencatat **kategori** (mis.
> `red_flag ... categories=cardiac`), tidak pernah kalimat user (CONTEXT §3 aturan 5).

---

## Langkah 6 — Verifikasi cron

Migrasi 0005 & 0009 sudah membuat jadwal. Cek:

```sql
select jobid, jobname, schedule, active
from cron.job
order by jobname;
```

Harus ada dua baris, keduanya `active = true`:

| jobname | schedule |
|---|---|
| `daily-scores-hourly` | `59 * * * *` |
| `send-reminders-hourly` | `5 * * * *` |

Setelah cron jalan minimal sekali, periksa hasil pemanggilan HTTP-nya:

```sql
-- riwayat eksekusi cron (status & pesan)
select jobid, status, return_message, start_time
from cron.job_run_details
order by start_time desc
limit 10;

-- respons HTTP dari pg_net (200 = fungsi terpanggil sukses)
select id, status_code, content
from net._http_response
order by created desc
limit 10;
```

> `status_code` 401 → Vault `service_role_key` salah (langkah 3).
> 404 → URL salah / fungsi belum deploy. 500 → cek `supabase functions logs`.

**Uji tanpa menunggu satu jam:** panggil manual seperti §5.3. `daily-score`
pakai `?force=1`. `send-reminders` mengikuti jam lokal + jam istirahat (22–07)
dan hanya mengirim bila ada yang personal — uji **sore hari** dengan target
hidrasi/langkah belum tercapai, dan pastikan sudah ada perangkat push terdaftar
(aktifkan "Ingatkan saya" di Beranda).

---

## Troubleshooting cepat

| Gejala | Kemungkinan sebab |
|---|---|
| Login Google memutar balik ke `/login` | Redirect URL app belum di allowlist (4.3) atau redirect URI Supabase belum di Google (4.1) |
| OTP email berisi tautan, bukan kode | Template email pakai `{{ .ConfirmationURL }}`, ganti ke `{{ .Token }}` (4.2) |
| Chat selalu `source: "fallback"` | `SUMOPOD_API_KEY`/`BASE_URL` salah, atau endpoint bukan OpenAI-compatible |
| Push tak pernah masuk | VAPID public key client ≠ Edge Function; atau belum ada `push_devices` aktif |
| Cron tak menulis `daily_scores` | Vault salah (401 di `net._http_response`) atau fungsi belum deploy (404) |
| `create extension` ditolak saat `db push` | Aktifkan `pg_cron`/`pg_net` manual di Dashboard → Extensions (2.2) |
| Deploy fungsi gagal soal import | Bundling tak menemukan import map — pakai `--import-map` (5.2) |

Setelah semua hijau, lanjut ke smoke test end-to-end §8 dan dogfood §10 di
[`deploy-checklist.md`](deploy-checklist.md).
