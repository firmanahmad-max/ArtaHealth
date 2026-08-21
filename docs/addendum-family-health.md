# Addendum · Family Health / Caregiver — Desain Sinkronisasi (FM-4)

Status: **DESAIN (menunggu persetujuan sebelum implementasi)**. Melengkapi roadmap Fase 6 #2 yang bertanda "perlu addendum". FM-1→FM-3 (roster + pantau biomarker anggota + alert) sudah LIVE-di-kode (lokal-first, di balik `NEXT_PUBLIC_FEATURE_FAMILY`). FM-4 = lapisan sinkronisasi.

## 1. Prinsip & batasan

- **Anggota keluarga = baris `profiles` nyata milik akun pemilik** (`account_id` = akun pemilik, `is_primary=false`), BUKAN akun terpisah. Pemilik mengelola penuh. → **Tidak ada consent lintas-akun** di FM-4 (itu skenario V3: anggota punya akun sendiri lalu menautkan).
- **Aditif & aman untuk yang LIVE**: seluruh perubahan sync harus membuat akun **tanpa anggota** berperilaku **identik** dengan hari ini (jalur cepat single-profile). Modul biomarker/Sadar Gizi/Vault LIVE tak boleh regresi.
- RLS `profiles` (0001) **sudah** mengizinkan owner CRUD profil `account_id=auth.uid()` → tak perlu migrasi RLS. `profiles` sudah punya `relation/date_of_birth/sex/is_primary/deleted_at`.

## 2. Dua pola sinkronisasi

| Data | Scope | Pola |
|---|---|---|
| **`profiles`** (roster anggota) | **account_id** | BARU — `syncProfiles()` account-scoped |
| Data kesehatan anggota (`biomarker_readings`, dll) | **profile_id** (per anggota) | pola SYNC_TABLES yang ada, tapi ditarik untuk **tiap** profile_id akun |

## 3. Keputusan desain

### A. Sinkronisasi `profiles` (account-scoped) — **fungsi terpisah `syncProfiles()`**
- **Push**: `family_members` lokal (buatan owner, belum ada `server_synced`) → `upsert profiles` (id, account_id, display_name, relation, date_of_birth, sex, is_primary=false). Pakai id lokal (uuid) sebagai `profiles.id` → konsisten sebagai `profile_id` data kesehatan.
- **Pull**: `select * from profiles where account_id = <akun> and updated_at > cursor` → `family_members` lokal (termasuk profil utama = "Saya").
- BUKAN dimasukkan ke SYNC_TABLES (yang mengasumsikan scope profile_id). Jalankan di loop sync bersama flush/pull.
- Menghapus anggota = tombstone `profiles.deleted_at` (jangan hard-delete; readings-nya cascade `on delete set null`/tetap).

### B. Menarik data kesehatan anggota — **`pullAll()` iterasi semua profile_id akun**
- Saat ini `pullAll` menarik untuk **satu** profil aktif. FM-4: tarik untuk **daftar profile_id akun** (owner + anggota).
- **Jalur cepat**: bila **tak ada anggota** (roster hanya "Saya") → persis seperti sekarang (satu profil). Multi-profil hanya aktif saat ada anggota → **regresi nol** untuk mayoritas pengguna.
- Data anggota mendarat di Dexie ber-`profileId` anggota. Query yang sudah difilter profileId (owner: `getActiveProfileId`; view anggota: `memberId`) otomatis benar — **fix kebocoran FM-2 sudah menyiapkan ini**.

### C. Push data anggota (urutan FK)
- `biomarker_readings.profile_id → profiles.id`. Reading anggota hanya boleh di-push **setelah** profil anggota ada di server.
- **Urutan tick sync**: `syncProfiles()` (buat profil anggota) → `flushOutbox()` (push readings) → `pullAll()`. Selama syncProfiles sukses lebih dulu, FK aman.
- Bila offline: anggota+readings antre; saat online, syncProfiles jalan dulu → aman.

### D. Aktifkan enqueue reading anggota
- FM-2 **sengaja tak enqueue** reading anggota (cegah FK-gagal memblok outbox sebelum profil ada). FM-4 **mengaktifkan enqueue** di `logMemberBiomarker`, **aman** karena urutan (C) menjamin profil anggota lebih dulu.
- Backfill: reading anggota lama (FM-2/3, belum enqueue) → enqueue sekali saat FM-4 aktif (atau biarkan lokal). Minor.

### E. Consent
- Tidak ada di FM-4 (anggota = sub-profil owner, bukan akun terpisah). Dicatat untuk V3.

## 4. Rencana increment

- **FM-4a** — `syncProfiles()` (push+pull `profiles` ↔ `family_members`) + wiring loop sync + `family_members` dapat kolom `serverSynced`/`updatedAt` untuk kursor. Uji: tambah anggota → muncul di tabel `profiles` server; perangkat lain menariknya.
- **FM-4b** — multi-profil pull di `pullAll` (iterasi profile_id akun, jalur cepat no-member) + aktifkan enqueue reading anggota + urutan FK. Uji: catat tensi anggota → tersimpan server → tampil di perangkat lain.
- **FM-4c** — verifikasi end-to-end + regresi (akun tanpa anggota = tak berubah).

## 5. Strategi uji (tanpa backend di mode lokal)
Loop sync **tak bisa** diuji di mode lokal (Supabase kosong). Seperti deploy Edge Function:
- **Smoke test terhadap Supabase produksi**: build lokal → env prod + `NEXT_PUBLIC_FEATURE_FAMILY=1` → login → tambah anggota → cek muncul di tabel `profiles` (query dashboard) + tarik di sesi kedua.
- **Unit test** bagian murni (mapping profiles↔family_members) di `packages/core` bila logikanya dipindah ke sana.
- Regresi wajib: akun **tanpa anggota** → sync identik (verifikasi jumlah request pull sama).

## 6. Risiko & mitigasi
| Risiko | Mitigasi |
|---|---|
| Regresi sync LIVE | Jalur cepat no-member = perilaku identik; guard ketat |
| FK reading anggota gagal → blok outbox | Urutan tick: syncProfiles sebelum flushOutbox; enqueue hanya setelah FM-4 |
| Konflik id profil (uuid lokal vs server) | id lokal = profiles.id (owner yang membuat, upsert onConflict id) |
| `uq_profiles_primary` (satu primary) | Anggota selalu is_primary=false |
| Tak bisa uji lokal | Smoke test prod + regresi no-member |

## 7. Di luar cakupan FM-4
Switcher profil global (semua fitur per-profil), data domain lain anggota (gizi/habit — pola sama, menyusul), consent lintas-akun, notifikasi push caregiver.
