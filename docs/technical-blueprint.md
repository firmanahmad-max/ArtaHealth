# ArtaHealth — Technical Blueprint & Execution Plan

### Elaborasi PRD v1.0 menjadi Spesifikasi Siap Eksekusi

**Version:** 1.0-TB
**Owner:** Arta Ecosystem — Firman Ahmad
**Prinsip Desain:** Modular · Scalable · Reliable · Stable · Secure
**Referensi:** PRD ArtaHealth v1.0, Arta Design System, arsitektur ArtaFin (Next.js 14 + Supabase + Sumopod)

---

## 0. Ringkasan Eksekutif

Dokumen ini menerjemahkan PRD ArtaHealth menjadi blueprint teknis yang bisa langsung dieksekusi. Keputusan utama:

1. **Arsitektur:** *Modular Monolith* berbasis Next.js 14 (App Router) + Supabase, dengan boundary modul yang tegas sehingga bisa dipecah menjadi services di masa depan tanpa rewrite.
2. **Pola data:** *Offline-first PWA* — semua pencatatan (hidrasi, tidur, aktivitas, habit) bekerja tanpa internet, sinkronisasi via queue.
3. **AI Layer:** Terpisah sebagai *AI Service Module* dengan provider abstraction (Sumopod production, opsi local LLM via LiteLLM untuk development — sesuai setup PC lokal Ryzen 7500F + RX 9070 XT).
4. **Keamanan:** Row Level Security (RLS) penuh, enkripsi field-level untuk data medis, kepatuhan UU PDP (UU No. 27/2022) sejak hari pertama.
5. **Positioning teknis:** ArtaHealth adalah *wellness companion*, **bukan alat medis** — semua output AI wajib melewati Safety Guard Layer dengan disclaimer engineering.

---

## 1. Arsitektur Sistem

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  Next.js 14 PWA (App Router) — Mobile-first, Installable     │
│  ├── Service Worker (offline cache + background sync)        │
│  ├── IndexedDB (local-first data store via Dexie.js)         │
│  └── Arta Design System (shared UI package)                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS / Supabase Client
┌──────────────────────────▼──────────────────────────────────┐
│                      BACKEND LAYER                           │
│  Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Fn) │
│  ├── RLS Policies (tenant isolation per user/family)         │
│  ├── Edge Functions (health score calc, AI orchestration)    │
│  └── pg_cron (daily insight jobs, reminder scheduling)       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                       AI LAYER                               │
│  AI Gateway (Edge Function / Cloudflare Worker)              │
│  ├── Provider Router: Sumopod (prod) | LiteLLM local (dev)   │
│  ├── Prompt Registry (versioned prompts per use-case)        │
│  ├── Safety Guard (medical disclaimer, red-flag detection)   │
│  └── Cost Guard (token budget per user tier)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   INTEGRATION LAYER (V3+)                    │
│  Health Connect (Android) · Apple HealthKit · Google Fit     │
│  Arta Ecosystem Bus: HariBaik · ArtaFin · Arta Assistant     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Kenapa Modular Monolith (bukan microservices dari awal)

- **Tim kecil / solo founder:** microservices menambah kompleksitas operasional (deployment, observability, network failure modes) tanpa keuntungan pada skala awal.
- **Boundary modul tetap dijaga:** setiap modul punya folder, schema namespace, dan interface sendiri. Migrasi ke service terpisah nanti = pindahkan folder + expose API.
- **Supabase menangani** auth, storage, realtime, dan cron — mengurangi kode infrastruktur ±60%.

### 1.3 Struktur Modul (Domain-Driven)

```
artahealth/
├── apps/
│   └── web/                      # Next.js 14 PWA
│       ├── app/                  # App Router pages
│       └── modules/              # UI per domain
├── packages/
│   ├── design-system/            # Arta Design System (shared antar produk Arta)
│   ├── core/                     # Types, utils, validation (Zod schemas)
│   └── ai-client/                # AI Gateway client SDK
├── supabase/
│   ├── migrations/               # SQL migrations (versioned)
│   ├── functions/                # Edge Functions per domain
│   │   ├── health-score/
│   │   ├── daily-insight/
│   │   ├── food-recognition/
│   │   ├── ai-chat/
│   │   └── ocr-vault/
│   └── seed/
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── CONTEXT.md                # Handoff untuk AI coding tool
```

**Modul domain (bounded contexts):**

| Modul | Tanggung Jawab | Fase |
|---|---|---|
| `identity` | Auth, profil, biometric, family members | V1 |
| `vitals` | Tidur, hidrasi, aktivitas, langkah, berat, mood, HR | V1 |
| `habits` | Habit engine, streak, target harian | V1 |
| `scoring` | Health Score calculation | V1 |
| `insight` | AI Daily Insight, AI Chat | V1 |
| `timeline` | Agregasi event lintas modul | V1 |
| `nutrition` | Food diary, kalori, makro, foto AI | V2 |
| `medication` | Jadwal obat, reminder, stok | V2 |
| `vault` | Medical Vault, OCR, dokumen | V2 |
| `family` | Multi-profil dalam satu akun | V2 |
| `gamification` | XP, badge, mission, level | V2 |
| `integration` | Wearables, Arta Ecosystem sync | V3 |
| `billing` | Free/PRO subscription | V2 |

Aturan dependensi: modul hanya boleh memanggil modul lain lewat **interface publik** (function/service export), tidak boleh query tabel modul lain secara langsung. `timeline` dan `scoring` adalah *read-model* yang mengonsumsi event dari modul lain.

---

## 2. Tech Stack (Keputusan Final)

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, App Router | Konsisten dengan ArtaFin & Arta Assistant |
| PWA | next-pwa / Serwist, Workbox | Installable, offline-first |
| Local DB | Dexie.js (IndexedDB) | Offline-first logging |
| State | Zustand + TanStack Query | Sederhana, cache-aware |
| Validasi | Zod (shared di client & server) | Single source of truth untuk schema |
| Backend | Supabase (PostgreSQL 15, Auth, Storage, Edge Functions, Realtime, pg_cron) | Sudah terbukti di ArtaFin |
| AI | Sumopod API (prod), LiteLLM + Ollama lokal (dev) | Cost control, konsisten ekosistem |
| Charts | Recharts | Ringan, cukup untuk health viz |
| OCR | Tesseract.js (client) → upgrade ke vision model via Sumopod (PRO) | Bertahap sesuai tier |
| Hosting | Vercel (app) + Supabase Cloud | Deployment pipeline yang sudah dikuasai |
| Monitoring | Sentry + Supabase Logs + Vercel Analytics | Observability minimum viable |
| CI/CD | GitHub Actions | Lint, typecheck, test, migration check |

---

## 3. Skema Database (PostgreSQL / Supabase)

### 3.1 Prinsip

- Semua tabel data kesehatan memiliki `profile_id` (bukan `user_id` langsung) → mendukung Family Health tanpa perombakan.
- RLS aktif di **semua** tabel, tanpa kecuali.
- Data time-series (hydration, sleep, activity) dipartisi per bulan saat volume tumbuh (siapkan dari awal dengan `logged_at` terindeks).
- Soft delete (`deleted_at`) untuk semua data user — mendukung recovery & audit.

### 3.2 Core Schema

```sql
-- ============ IDENTITY ============
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id) on delete cascade,
  display_name  text not null,
  relation      text not null default 'self',  -- self|father|mother|child|elder|other
  date_of_birth date,
  sex           text,                           -- male|female (untuk kalkulasi TDEE/hidrasi)
  height_cm     numeric(5,2),
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table emergency_cards (
  profile_id      uuid primary key references profiles(id) on delete cascade,
  blood_type      text,
  allergies       text[],
  conditions      text[],          -- penyakit penting
  emergency_contacts jsonb,        -- [{name, phone, relation}]
  bpjs_number_enc text,            -- ENCRYPTED (pgsodium)
  insurance_enc   text,            -- ENCRYPTED
  updated_at      timestamptz not null default now()
);

-- ============ VITALS ============
create table hydration_logs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  beverage    text not null default 'water',  -- water|coffee|tea|milk|juice
  volume_ml   int not null check (volume_ml between 1 and 5000),
  logged_at   timestamptz not null default now(),
  source      text not null default 'manual', -- manual|quick_add|voice|wearable
  client_id   text,                            -- idempotency key untuk offline sync
  deleted_at  timestamptz,
  unique (profile_id, client_id)
);

create table sleep_logs (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id),
  sleep_start   timestamptz not null,
  sleep_end     timestamptz not null,
  quality       smallint check (quality between 1 and 5),
  source        text not null default 'manual',
  client_id     text,
  deleted_at    timestamptz,
  unique (profile_id, client_id),
  check (sleep_end > sleep_start)
);

create table activity_logs (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id),
  activity_type text not null,     -- walk|run|cycle|gym|stretch|yoga|other
  duration_min  int,
  steps         int,
  calories_out  int,
  logged_at     timestamptz not null default now(),
  source        text not null default 'manual',
  client_id     text,
  deleted_at    timestamptz,
  unique (profile_id, client_id)
);

create table weight_logs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  weight_kg   numeric(5,2) not null check (weight_kg between 20 and 400),
  logged_at   timestamptz not null default now(),
  client_id   text,
  deleted_at  timestamptz,
  unique (profile_id, client_id)
);

create table mood_logs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id),
  mood        smallint not null check (mood between 1 and 5),
  note        text,
  logged_at   timestamptz not null default now(),
  client_id   text,
  deleted_at  timestamptz,
  unique (profile_id, client_id)
);

-- ============ HABITS ============
create table habits (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  name         text not null,
  icon         text,
  target_type  text not null default 'boolean',  -- boolean|count|duration
  target_value int,
  schedule     jsonb not null default '{"days":[1,2,3,4,5,6,7]}',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table habit_completions (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references habits(id) on delete cascade,
  profile_id  uuid not null references profiles(id),
  date        date not null,
  value       int not null default 1,
  client_id   text,
  unique (habit_id, date)
);

-- ============ SCORING (read model) ============
create table daily_scores (
  profile_id     uuid not null references profiles(id),
  date           date not null,
  health_score   smallint not null check (health_score between 0 and 100),
  breakdown      jsonb not null,   -- {sleep: 22, hydration: 18, activity: 15, ...}
  computed_at    timestamptz not null default now(),
  primary key (profile_id, date)
);

-- ============ INSIGHT ============
create table ai_insights (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  insight_type text not null,      -- daily|weekly|correlation|alert
  content      text not null,
  data_context jsonb,              -- snapshot data yang dipakai AI
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create table ai_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  session_id   uuid not null,
  role         text not null check (role in ('user','assistant')),
  content      text not null,
  token_count  int,
  created_at   timestamptz not null default now()
);

-- ============ NUTRITION (V2) ============
create table food_logs (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  meal_type    text not null,      -- breakfast|lunch|dinner|snack
  food_name    text not null,
  calories     int,
  protein_g    numeric(6,2),
  fat_g        numeric(6,2),
  carbs_g      numeric(6,2),
  photo_path   text,               -- Supabase Storage path
  ai_confidence numeric(3,2),      -- confidence pengenalan foto
  logged_at    timestamptz not null default now(),
  client_id    text,
  deleted_at   timestamptz,
  unique (profile_id, client_id)
);

-- ============ MEDICATION (V2) ============
create table medications (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  name         text not null,
  dosage       text,
  schedule     jsonb not null,     -- {times: ["08:00","20:00"], days: [...]}
  stock        int,
  stock_alert  int default 5,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table medication_intakes (
  id            uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  profile_id    uuid not null references profiles(id),
  scheduled_at  timestamptz not null,
  taken_at      timestamptz,
  status        text not null default 'pending' -- pending|taken|skipped|missed
);

-- ============ VAULT (V2) ============
create table medical_documents (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  doc_type     text not null,      -- mcu|lab|prescription|vaccine|radiology|bpjs|insurance|other
  title        text not null,
  storage_path text not null,      -- bucket privat, akses via signed URL
  ocr_text_enc text,               -- hasil OCR, ENCRYPTED
  doc_date     date,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ============ GAMIFICATION (V2) ============
create table player_stats (
  profile_id   uuid primary key references profiles(id),
  xp           int not null default 0,
  level        int not null default 1,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  updated_at   timestamptz not null default now()
);

create table achievements (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id),
  badge_key    text not null,
  earned_at    timestamptz not null default now(),
  unique (profile_id, badge_key)
);

-- ============ BILLING ============
create table subscriptions (
  account_id   uuid primary key references auth.users(id),
  tier         text not null default 'free',  -- free|pro
  valid_until  timestamptz,
  provider     text,               -- midtrans|manual|playstore
  updated_at   timestamptz not null default now()
);
```

### 3.3 Index Strategy

```sql
create index idx_hydration_profile_time on hydration_logs (profile_id, logged_at desc);
create index idx_sleep_profile_time     on sleep_logs (profile_id, sleep_start desc);
create index idx_activity_profile_time  on activity_logs (profile_id, logged_at desc);
create index idx_food_profile_time      on food_logs (profile_id, logged_at desc);
create index idx_insights_profile       on ai_insights (profile_id, created_at desc);
create index idx_chat_session           on ai_chat_messages (session_id, created_at);
```

### 3.4 RLS Policy Pattern

```sql
alter table hydration_logs enable row level security;

create policy "own_profile_data" on hydration_logs
  for all using (
    profile_id in (
      select id from profiles where account_id = auth.uid()
    )
  );
-- Pola yang sama diterapkan ke SEMUA tabel ber-profile_id.
-- Tidak ada policy 'public'. Tidak ada bypass kecuali service_role di Edge Functions.
```

---

## 4. Health Score Engine (Deterministik, bukan LLM)

Health Score **tidak dihitung oleh LLM** — harus deterministik, bisa dijelaskan, dan konsisten. LLM hanya menulis *narasi* dari skor.

### 4.1 Formula V1

```
HealthScore = round(
  W_sleep     * S_sleep     +   // 30%
  W_hydration * S_hydration +   // 20%
  W_activity  * S_activity  +   // 25%
  W_mood      * S_mood      +   // 10%
  W_habit     * S_habit         // 15%
)
```

Setiap sub-skor dinormalisasi 0–100:

- **S_sleep:** 100 jika durasi 7–9 jam dan konsistensi jam tidur ±45 menit dari rata-rata 7 hari; penalti linear di luar rentang.
- **S_hydration:** `min(intake / target, 1) * 100`; target = 35ml × berat badan, disesuaikan aktivitas (+500ml jika olahraga >30 menit).
- **S_activity:** kombinasi langkah (target default 8.000) + menit aktivitas (target WHO 150 menit/minggu → 22 menit/hari).
- **S_mood:** rata-rata mood harian × 20.
- **S_habit:** persentase habit selesai hari itu.

Jika ada parameter tanpa data → bobotnya diredistribusi proporsional ke parameter lain, dan breakdown mencatat `"no_data"` (skor tidak dihukum karena tidak mencatat — mencegah demotivasi).

### 4.2 Eksekusi

- Dihitung **real-time di client** (untuk feedback instan) dan **final di Edge Function** via pg_cron pukul 23:59 waktu lokal user → tulis ke `daily_scores`.
- Breakdown JSON disimpan agar AI Insight bisa menjelaskan "kenapa skor naik/turun" dengan data nyata, bukan halusinasi.

---

## 5. AI Layer — Desain Detail

### 5.1 AI Gateway (Single Entry Point)

Semua panggilan AI melewati satu Edge Function `ai-gateway` dengan kontrak:

```typescript
interface AIRequest {
  useCase: 'daily_insight' | 'chat' | 'food_recognition' 
         | 'correlation' | 'ocr_extract' | 'weekly_report';
  profileId: string;
  payload: Record<string, unknown>;
  locale: 'id' | 'en';
}
```

Tanggung jawab gateway:

1. **Auth & tier check** — AI Chat unlimited hanya PRO; free tier dapat kuota (mis. 5 chat/hari).
2. **Provider routing** — Sumopod (production). Konfigurasi via env agar bisa diarahkan ke LiteLLM lokal saat development.
3. **Prompt Registry** — prompt disimpan versioned di tabel/file, bukan hardcoded. Setiap use-case punya prompt template + system prompt sendiri.
4. **Context builder** — mengambil data 7–30 hari terakhir dari read model, dirangkum menjadi JSON kompak (bukan raw rows) untuk hemat token.
5. **Safety Guard** (lihat 5.3).
6. **Cost Guard** — hitung `token_count`, simpan ke `ai_chat_messages`, enforce budget bulanan per user.
7. **Caching** — Daily Insight di-generate sekali per hari per profil, disimpan di `ai_insights`; tidak pernah regenerate on-demand.

### 5.2 Contoh Kontrak Daily Insight

```
INPUT (context builder):
{
  "date": "2026-07-11",
  "sleep": {"duration_min": 462, "vs_avg7d": "+18min", "consistency": "good"},
  "hydration": {"total_ml": 1800, "target_ml": 2450, "pct": 73},
  "activity": {"steps": 6200, "target": 8000, "exercise_min": 0},
  "mood": 4,
  "habits": {"completed": 3, "total": 5},
  "score": {"today": 82, "yesterday": 76, "delta_reason": ["sleep_up","hydration_down"]}
}

OUTPUT (JSON only, divalidasi Zod sebelum disimpan):
{
  "summary": "...",
  "targets": ["8.000 langkah", "Minum 2,5 liter air", "..."],
  "motivation": "...",
  "focus_area": "hydration"
}
```

Aturan keras: output AI **selalu JSON**, selalu divalidasi schema, gagal validasi → retry sekali → fallback ke template deterministik (aplikasi tidak pernah kosong karena AI down).

### 5.3 Safety Guard Layer (Wajib — ini pembeda reliability)

Karena domain kesehatan:

- **System prompt setiap use-case** menegaskan: edukasi umum & lifestyle saja, bukan diagnosis, bukan saran medis, tidak menyebut dosis obat.
- **Red-flag detector** (keyword + klasifikasi ringan) pada input chat: nyeri dada, sesak napas berat, ide menyakiti diri, pendarahan, dsb. → respons template yang mengarahkan ke layanan darurat (119) / tenaga medis, AI tidak melanjutkan analisis.
- **Disclaimer persisten** di UI AI Chat dan setiap insight yang menyentuh kondisi tubuh.
- **Guard output:** post-filter yang memblokir jika respons AI mengandung klaim diagnosis atau resep.
- Semua interaksi red-flag dicatat (audit log) tanpa menyimpan konten sensitif berlebihan.

### 5.4 Food Recognition Pipeline (V2)

```
Foto → kompres client-side (max 1024px, webp)
     → upload ke bucket privat
     → Edge Function panggil vision model (Sumopod)
     → output JSON {food_name, calories, protein, fat, carbs, confidence}
     → jika confidence < 0.6 → minta konfirmasi user (UI pilihan)
     → simpan ke food_logs
```

Nilai gizi divalidasi terhadap database nutrisi lokal (TKPI — Tabel Komposisi Pangan Indonesia, di-seed sebagai tabel referensi) agar tidak sepenuhnya bergantung pada estimasi LLM.

---

## 6. Offline-First & Sync Engine (Kunci Reliability)

### 6.1 Prinsip

Pencatatan kesehatan terjadi kapan saja — di gym, di jalan, saat sinyal buruk di Samarinda sekalipun. Maka:

- **Write path:** semua log ditulis ke IndexedDB dulu (instan), lalu masuk *outbox queue*.
- **Sync worker:** Background Sync API / interval flush mengirim batch ke Supabase.
- **Idempotency:** setiap log punya `client_id` (UUID dari device) + unique constraint di DB → retry aman, tidak ada duplikat.
- **Conflict resolution:** last-write-wins per record (data log bersifat append-mostly, konflik jarang); untuk edit, gunakan `updated_at` comparison.
- **Read path:** TanStack Query dengan cache persisten; dashboard selalu render dari data lokal, lalu revalidate.

### 6.2 Status Sync di UI

Indikator kecil (✓ tersinkron / ↻ menunggu) di dashboard — transparansi membangun kepercayaan tanpa mengganggu.

---

## 7. Keamanan & Kepatuhan

### 7.1 Klasifikasi Data

| Tier | Contoh | Perlakuan |
|---|---|---|
| T1 — Sangat Sensitif | Dokumen medis, hasil lab, OCR text, nomor BPJS/asuransi, kondisi penyakit | Enkripsi field-level (pgsodium) + bucket privat + signed URL berumur pendek (60 detik) |
| T2 — Sensitif | Log tidur, mood, berat, obat, chat AI | RLS ketat, TLS, tidak pernah masuk log/analytics |
| T3 — Rendah | Preferensi UI, streak, XP | RLS standar |

### 7.2 Kontrol Wajib

- **RLS di semua tabel** (satu-satunya jalur bypass: service_role di Edge Functions, tidak pernah di client).
- **Enkripsi at-rest** field T1 dengan `pgsodium` (key dikelola Supabase Vault).
- **Biometric/PIN lock** di client (WebAuthn untuk PWA; App Lock layer sebelum render data).
- **Auth:** Supabase Auth — email OTP + Google OAuth; session refresh rotation.
- **Consent management:** tabel `consents` mencatat persetujuan eksplisit per integrasi (wearable, sync ekosistem, family sharing) dengan timestamp — memenuhi UU PDP Pasal 20 (persetujuan eksplisit untuk data kesehatan sebagai data pribadi spesifik).
- **Hak subjek data (UU PDP):** fitur *Export All Data* (JSON/PDF) dan *Delete Account* (hard delete cascade + purge storage dalam 30 hari) sejak V1.
- **Rate limiting** di AI Gateway dan endpoint tulis (per-user, sliding window).
- **Audit log** untuk akses Medical Vault dan perubahan Emergency Card.
- **Secrets:** semua API key hanya di Edge Functions env; client tidak pernah memegang key Sumopod.
- **Dependency hygiene:** Dependabot + `npm audit` di CI.

### 7.3 Family Health & Privasi

- Data anggota keluarga dimiliki oleh `account_id` pemilik akun — model "kepala keluarga mengelola".
- Untuk anggota dewasa yang punya akun sendiri (roadmap V3): mekanisme *invite & consent* dua arah, bukan sekadar ditambahkan.

---

## 8. Reliability & Stability Engineering

| Area | Praktik |
|---|---|
| Error handling | Error boundary per modul UI; AI failure → fallback template; sync failure → retry exponential backoff (max 5, lalu antre) |
| Graceful degradation | AI down → dashboard & logging tetap 100% fungsional; skor tetap dihitung lokal |
| Data integrity | Check constraints di DB (bukan hanya di client); Zod validation dua sisi |
| Migrations | Semua perubahan schema via file migration, di-review, tidak pernah edit langsung di dashboard Supabase |
| Backup | Supabase PITR (PRO plan) + export mingguan otomatis ke storage terpisah |
| Monitoring | Sentry (client+edge), alert ke Telegram via ArtaBot untuk error rate & AI failure spike |
| Testing | Vitest (unit: scoring engine wajib 100% coverage — ini jantung produk), Playwright (E2E happy path: log air → skor berubah), kontrak Zod sebagai test schema AI |
| Feature flags | Tabel `feature_flags` sederhana → rollout bertahap fitur V2+ tanpa redeploy |

---

## 9. Integrasi Arta Ecosystem

### 9.1 Pola: Event Bus Sederhana

Tabel `ecosystem_events` di masing-masing produk + webhook antar-Supabase project (atau satu Supabase organization dengan schema terpisah — direkomendasikan untuk fase awal):

```
artahealth  → artafin   : event "health_expense_logged" (beli obat, konsultasi)
artafin     → artahealth: kategori "Kesehatan" ter-tag → tampil di medical budget
haribaik    → artahealth: reminder ibadah/olahraga selaras jadwal tidur
artahealth  → arta      : endpoint query "ringkasan kesehatan minggu ini" (voice)
```

Semua sinkronisasi **opt-in per consent record** (lihat 7.2). Format event distandarkan di `packages/core` sebagai bagian Arta Design System level data.

### 9.2 Arta Design System

ArtaHealth mengadopsi shared package `@arta/design-system` (yang sudah direncanakan untuk redesign ArtaPOS): token warna (gradient blue-cyan-purple), tipografi Inter, komponen Card/ProgressRing/BottomNav. ArtaHealth menjadi produk kedua yang memvalidasi design system ini.

---

## 10. UI/UX — Spesifikasi Implementasi

- **Bottom Navigation 5 tab** sesuai PRD (Beranda, Timeline, AI Chat, Program, Profil) — komponen dari design system.
- **Dashboard:** Health Score sebagai *hero* (animated progress ring, count-up animation), grid kartu vitals di bawahnya. Quick-log FAB (+) dengan aksi cepat: air 250ml, mood, berat.
- **Timeline:** virtual list (untuk performa), grouping per hari, ikon per event type.
- **Glassmorphism ringan:** `backdrop-blur` hanya pada header & FAB (hemat GPU di device low-end — penting untuk pasar Indonesia).
- **Dark/Light mode:** CSS variables dari design token, mengikuti system preference + toggle manual.
- **Aksesibilitas:** kontras WCAG AA, target sentuh min 44px, angka skor punya label teks.
- **Performa target:** LCP < 2.5s di 4G, bundle awal < 200KB gzip (code-splitting per modul).

---

## 11. Monetisasi — Implementasi

| Kontrol | Free | PRO |
|---|---|---|
| AI Daily Insight | 1×/hari (template-enhanced) | Full AI + weekly report |
| AI Chat | 5 pesan/hari | Unlimited (fair use 200/hari) |
| OCR Vault | — | ✓ |
| Family Health | 1 profil | 6 profil |
| Analytics | 7 hari | 365 hari + export PDF |
| Backup | — | Cloud + export |

- Enforcement di **server** (AI Gateway + RLS-aware checks), bukan hanya UI.
- Payment: Midtrans (pasar Indonesia — QRIS, GoPay, VA) untuk web; siapkan abstraksi `billing provider` agar Play Billing bisa masuk saat wrap ke TWA/Capacitor.

---

## 12. Rencana Eksekusi

### Phase 1 — Foundation & V1 Core (6–8 minggu)

**Sprint 1–2: Fondasi**
- Setup monorepo (pnpm workspaces), Supabase project, CI/CD
- Skema `identity`, `vitals`, `habits` + RLS + migrations
- Auth flow, onboarding (profil, berat, tinggi, target)
- Design system: token + 8 komponen inti

**Sprint 3–4: Logging & Score**
- Quick-log hidrasi, tidur, aktivitas, mood, berat (offline-first + sync engine)
- Scoring engine (unit-tested penuh) + `daily_scores` cron
- Dashboard + Timeline

**Sprint 5–6: AI & Habit**
- AI Gateway + Prompt Registry + Safety Guard
- Daily Insight + AI Chat (free quota)
- Habit engine + streak
- PWA polish (installable, offline, push notification via FCM)

**Exit criteria V1:** user bisa hidup dengan aplikasi 7 hari penuh offline-tolerant, skor akurat & bisa dijelaskan, AI insight muncul tiap pagi, zero critical Sentry issue selama 1 minggu beta.

### Phase 2 — V2 (8–10 minggu)
Food Diary AI → Medicine Reminder → Medical Vault (+enkripsi & audit) → Family Health → Gamification → Billing PRO.

### Phase 3 — V3 (10–12 minggu)
Health Connect (Android, prioritas pasar) → Apple HealthKit → korelasi AI lintas-metrik → Weekly/Monthly Health Report PDF → integrasi Arta Assistant voice.

### Phase 4 — V4
AI Preventive (tren jangka panjang + anomaly detection), Wellness Coach program terstruktur, eksplorasi kemitraan lab (wajib review regulasi Kemenkes/SATUSEHAT terlebih dahulu).

---

## 13. Definition of Done (Setiap Fitur)

1. Migration + RLS policy ter-review
2. Zod schema shared client/server
3. Bekerja offline (jika fitur logging)
4. Unit test untuk logika inti; E2E untuk happy path
5. Error state & empty state di-design (bukan blank)
6. Tidak ada data T1/T2 masuk analytics/log
7. Dark mode & mobile 360px teruji
8. Copy Bahasa Indonesia di-review (tone: hangat, bukan klinis)

---

## 14. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Halusinasi AI di domain kesehatan | Kepercayaan hancur, risiko hukum | Safety Guard, output JSON tervalidasi, skor deterministik, disclaimer |
| Biaya API AI membengkak | Margin negatif | Cache insight harian, quota per tier, context ringkas, opsi model kecil untuk task ringan |
| Kebocoran data medis | Fatal (UU PDP, reputasi) | Enkripsi T1, RLS total, audit log, tidak ada key di client |
| User berhenti mencatat (churn) | Produk mati | Quick-log <3 detik, no-data tidak menghukum skor, streak & gamification, push notification cerdas |
| Scope creep (PRD sangat luas) | Tidak pernah launch | Phase gate ketat; V1 hanya 7 fitur inti; fitur lain di belakang feature flag |
| Kompetitor besar (Samsung Health dll.) | Sulit diferensiasi | Fokus: Bahasa Indonesia natural, insight AI personal, integrasi Arta Ecosystem, harga lokal |

---

## 15. Lampiran — CONTEXT.md Starter (untuk AI Coding Tool)

Saat memulai coding session, gunakan ringkasan ini sebagai konteks awal:

```
PROJECT: ArtaHealth — AI Personal Health Companion (PWA)
STACK: Next.js 14 App Router + TypeScript + Tailwind + Supabase + Dexie.js
       + Zustand + TanStack Query + Zod + Sumopod AI (via Edge Function gateway)
ARCHITECTURE: Modular monolith, domain modules (identity, vitals, habits,
       scoring, insight, timeline), offline-first dengan outbox sync +
       client_id idempotency, RLS di semua tabel.
RULES:
 - Health Score dihitung deterministik (bukan LLM). LLM hanya narasi.
 - Semua output AI = JSON tervalidasi Zod, dengan fallback template.
 - Data medis T1 dienkripsi pgsodium; tidak ada API key di client.
 - Setiap fitur logging harus bekerja offline.
 - UI pakai @arta/design-system, Bahasa Indonesia, dark+light mode.
 - Bukan alat medis: Safety Guard + disclaimer wajib di semua fitur AI.
PHASE SAAT INI: V1 (dashboard, vitals logging, score, habit, daily insight, chat)
```

---

*Dokumen ini adalah jembatan antara PRD v1.0 dan eksekusi. Setiap keputusan arsitektur di sini boleh ditantang — tapi harus diganti dengan keputusan lain, bukan dibiarkan ambigu.*
