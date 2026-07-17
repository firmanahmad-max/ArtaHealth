# ArtaHealth — UI/UX Design Specification

### Elaborasi Prototipe menjadi Spesifikasi Desain Siap Implementasi

**Version:** 1.0-DS
**Owner:** Arta Ecosystem — Firman Ahmad
**Basis:** Prototipe UI ArtaHealth (dark premium, mascot AI, Health Ring) + Technical Blueprint v1.0-TB
**Target:** Komponen `@arta/design-system` + implementasi Next.js 14 PWA (mobile-first 360–430px)

---

## 0. Membaca Prototipe: Apa yang Sudah Benar & Dikunci

Dari prototipe, keputusan desain berikut **dikunci sebagai identitas** dan tidak boleh berubah tanpa alasan kuat:

| Elemen | Keputusan di Prototipe | Status |
|---|---|---|
| Mode utama | Dark premium (near-black, bukan abu gelap) | 🔒 Dikunci — light mode adalah turunan |
| Hero dashboard | Health Score 89/100 + animated ring gradient | 🔒 Dikunci — ini *signature element* produk |
| Aksen | Gradient Blue → Cyan → Purple | 🔒 Dikunci |
| Persona AI | Mascot robot ramah (Arta Bot) dengan sapaan personal ("Halo Firman! 👋") | 🔒 Dikunci |
| Navigasi | Bottom nav 5 tab: Beranda · Timeline · AI Chat · Program · Profil | 🔒 Dikunci |
| Bahasa UI | Bahasa Indonesia hangat, sapaan langsung ("Anda") | 🔒 Dikunci |
| Struktur kartu | Rounded card besar (radius ±20px), grid metrik 4 kolom | 🔒 Dikunci |

**Signature element:** *Health Ring* — cincin gradien animasi yang membungkus Health Score. Ini satu-satunya tempat kita "boros" motion dan efek. Semua elemen lain disiplin dan tenang. Health Ring juga menjadi ikon status di Timeline, widget, dan notifikasi — satu bentuk yang dikenali di seluruh produk.

---

## 1. Design Tokens (`@arta/design-system`)

### 1.1 Warna — Dark Mode (default)

```css
:root[data-theme="dark"] {
  /* ---- Surface ---- */
  --ah-bg:            #0A0E1A;   /* latar utama, biru-hitam bukan hitam murni */
  --ah-surface-1:     #111629;   /* kartu level 1 */
  --ah-surface-2:     #1A2138;   /* kartu di atas kartu, chip, input */
  --ah-surface-glass: rgba(26, 33, 56, 0.72); /* header & FAB, backdrop-blur 12px */
  --ah-border:        rgba(148, 163, 208, 0.14);

  /* ---- Brand Gradient (Health Ring) ---- */
  --ah-blue:    #3B82F6;
  --ah-cyan:    #22D3EE;
  --ah-purple:  #8B5CF6;
  --ah-gradient-hero: linear-gradient(135deg, #3B82F6 0%, #22D3EE 50%, #8B5CF6 100%);
  --ah-gradient-soft: linear-gradient(135deg, rgba(59,130,246,.16), rgba(139,92,246,.16));

  /* ---- Teks ---- */
  --ah-text-primary:   #F3F6FF;
  --ah-text-secondary: #9AA5C4;
  --ah-text-tertiary:  #5E6A8C;

  /* ---- Semantik Kesehatan (bukan sekadar merah-hijau) ---- */
  --ah-score-excellent: #34D399;  /* 85–100 · Sangat Baik */
  --ah-score-good:      #22D3EE;  /* 70–84  · Baik */
  --ah-score-fair:      #FBBF24;  /* 50–69  · Cukup */
  --ah-score-low:       #F87171;  /* 0–49   · Perlu Perhatian */

  /* ---- Warna Domain (konsisten di kartu, ikon, chart) ---- */
  --ah-sleep:     #818CF8;  /* indigo */
  --ah-hydration: #38BDF8;  /* sky */
  --ah-activity:  #2DD4BF;  /* teal */
  --ah-nutrition: #FB923C;  /* orange */
  --ah-mood:      #F472B6;  /* pink */
  --ah-heart:     #FB7185;  /* rose */
  --ah-medical:   #A78BFA;  /* violet — Vault & obat */
}
```

### 1.2 Warna — Light Mode (turunan, bukan inversi mentah)

```css
:root[data-theme="light"] {
  --ah-bg:            #F6F8FE;
  --ah-surface-1:     #FFFFFF;
  --ah-surface-2:     #EEF2FB;
  --ah-surface-glass: rgba(255,255,255,0.78);
  --ah-border:        rgba(30, 41, 82, 0.10);
  --ah-text-primary:   #101830;
  --ah-text-secondary: #4A5578;
  --ah-text-tertiary:  #8A93B2;
  /* Brand & domain colors tetap sama — diturunkan saturasinya 8% via color-mix bila kontras gagal */
}
```

**Aturan:** semua warna hanya via CSS variables. Tidak ada hex hardcoded di komponen. Kontras teks vs surface wajib ≥ 4.5:1 (AA); angka besar (score, metrik) ≥ 3:1.

### 1.3 Tipografi

| Role | Font | Ukuran / Weight | Pemakaian |
|---|---|---|---|
| Display | **Inter** (variable) | 44/48px · 700 · tracking -2% | Angka Health Score |
| Metric | Inter | 26px · 700 · tabular-nums | Angka metrik kartu (7j 45m, 2,1 L) |
| H1 | Inter | 22px · 700 | Judul layar, sapaan |
| H2 | Inter | 17px · 600 | Judul kartu |
| Body | Inter | 15px · 400 · line-height 1.55 | Insight, chat, deskripsi |
| Caption | Inter | 12px · 500 · tracking +2% | Label, satuan, timestamp |
| Badge | Inter | 11px · 600 · uppercase-off | Chip status ("Baik", "Normal") |

Catatan: satu keluarga font (Inter variable) = bundle kecil + konsistensi. Karakter dibawa oleh **ukuran ekstrem dan tabular numerals**, bukan pergantian typeface. Angka selalu `font-variant-numeric: tabular-nums` agar tidak "goyang" saat count-up.

### 1.4 Spacing, Radius, Elevation

```
Spacing scale : 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48  (base-4)
Page padding  : 16px (mobile), 24px (≥430px)
Card gap      : 12px

Radius:
  --ah-r-card:  20px   /* kartu utama */
  --ah-r-inner: 14px   /* kartu dalam kartu, chip besar */
  --ah-r-chip:  10px
  --ah-r-full:  999px  /* pill, avatar, FAB */

Elevation (dark mode pakai border+glow, bukan shadow gelap):
  level-1: border 1px var(--ah-border)
  level-2: border + shadow 0 8px 24px rgba(0,0,0,.35)
  hero   : border + inner-glow gradient 1px (Health Score card saja)
```

### 1.5 Motion Tokens

```
--ah-ease-out:    cubic-bezier(0.16, 1, 0.3, 1)     /* masuk */
--ah-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)  /* FAB, checkmark */
--ah-dur-fast:  150ms   /* hover, press */
--ah-dur-med:   300ms   /* kartu masuk, tab switch */
--ah-dur-slow:  800ms   /* Health Ring sweep */
--ah-dur-count: 1200ms  /* count-up angka score */
```

`prefers-reduced-motion: reduce` → ring langsung terisi tanpa sweep, angka langsung tampil, semua transisi jadi opacity 150ms. **Wajib, bukan opsional.**

---

## 2. Component Library (17 Komponen Inti)

Setiap komponen wajib punya 5 state: **default · loading (skeleton) · empty · error · offline-pending**.

### 2.1 `<HealthRing />` — Signature Component

Props: `score (0–100)`, `size (sm 48 | md 96 | lg 168)`, `animated`.

- SVG dua lingkaran: track (`--ah-surface-2`) + progress stroke gradient (`--ah-gradient-hero`), `stroke-linecap: round`.
- Animasi masuk: sweep dari 0 → skor (800ms ease-out) + count-up angka (1200ms) + haptic ringan di akhir (Vibration API 10ms).
- Warna label mengikuti band skor (`Sangat Baik` = `--ah-score-excellent`, dst.).
- `size="sm"` dipakai sebagai indikator di Timeline header & notifikasi — konsistensi bentuk.
- Aksesibilitas: `role="meter"`, `aria-valuenow`, teks label selalu tampil (warna bukan satu-satunya penanda).

### 2.2 `<MetricCard />`

Kartu metrik grid (Tidur / Aktivitas / Hidrasi / Kalori di prototipe).

- Anatomi: ikon domain (warna domain) → nilai (Metric type) → satuan (Caption) → chip status.
- Tap → buka detail sheet domain terkait (bukan pindah halaman — jaga konteks dashboard).
- Empty state: nilai diganti tombol hantu "+ Catat" — **layar kosong adalah undangan bertindak**.
- Offline-pending: titik kecil ↻ di pojok, tooltip "Menunggu sinkron".

### 2.3 `<InsightBanner />` — AI Health Insight

Banner atas dashboard (di prototipe: "Health Score Anda naik 6 poin...").

- Anatomi: avatar Arta Bot (32px) + judul insight + body 2 baris max + tombol tutup (✕).
- Latar `--ah-gradient-soft` + border gradient tipis — satu-satunya kartu selain hero yang boleh pakai gradien.
- Konten dari `ai_insights` (cached harian). Loading: skeleton 2 baris. AI gagal: banner tetap muncul dengan template deterministik ("Tidur Anda 7j 45m — di rentang sehat 👍") — **user tidak pernah tahu AI sedang down**.
- Maksimal 1 banner per hari; ✕ = dismiss sampai insight berikutnya (simpan `read_at`).

### 2.4 `<QuickLogFAB />`

FAB (+) kanan-bawah, di atas bottom nav.

- Tap → radial/stack menu 4 aksi: 💧 Air 250ml · 😊 Mood · ⚖️ Berat · 🏃 Aktivitas.
- **Air 250ml adalah one-tap**: tap → log tercatat → FAB morph jadi ✓ (spring, 400ms) → kembali. Tanpa dialog. Target: log air < 2 detik. Ini metrik UX terpenting melawan churn.
- Long-press aksi air → sheet pilihan volume & jenis minuman.
- Menu radial buka: 250ms stagger 40ms per item; tutup dengan tap luar / swipe down.

### 2.5 `<TimelineItem />`

- Anatomi: waktu (Caption, kiri, lebar tetap 48px) → garis vertikal + node ikon domain → kartu konten (judul + detail + chip).
- Node ikon memakai warna domain → timeline terbaca sekilas tanpa membaca teks.
- Grouping per hari, sticky date header, virtual list (`@tanstack/react-virtual`).
- Item pending-sync: opacity 0.75 + ikon ↻.

### 2.6 `<ChatBubble />` + `<SuggestionChips />`

- Bubble user: `--ah-surface-2`, kanan. Bubble AI: `--ah-surface-1` + avatar bot, kiri.
- Streaming: teks muncul token-by-token dengan caret berkedip; tanpa "typing dots" palsu setelah stream mulai.
- `<SuggestionChips />`: 3 chip pertanyaan kontekstual (dari prototipe: "Bagaimana kondisi kesehatan minggu ini?"). Chip di-generate dari data hari itu (mis. hidrasi rendah → chip "Kenapa saya harus minum lebih banyak?").
- **Disclaimer pill permanen** di atas input: "ArtaHealth memberi edukasi umum, bukan pengganti konsultasi dokter" — Caption, `--ah-text-tertiary`, tidak bisa di-dismiss.
- Red-flag response: bubble khusus border `--ah-score-low` + tombol besar "Hubungi 119" (`tel:119`) + "Cari faskes terdekat".

### 2.7 `<HydrationTracker />`

Kartu hidrasi detail (panel kanan prototipe: 2,1/2,5 L, 84%, deretan gelas).

- Deretan 8 ikon gelas: terisi = fill animasi "air naik" (clip-path, 300ms), kosong = outline. Tap gelas kosong = log 250ml (alternatif FAB).
- Ring mini 84% (HealthRing size sm, warna `--ah-hydration`).
- Tombol (+) → sheet: slider volume + jenis minuman (air/kopi/teh/susu/jus; kopi & teh dihitung 0.8× ke target — dijelaskan lewat tooltip ⓘ).

### 2.8 `<SleepChart />` & `<BarSparkline />`

- Sleep Analysis (prototipe): bar chart hipnogram sederhana per interval, warna per fase (Deep `--ah-purple` · Light `--ah-blue` · REM `--ah-cyan` · Awake `--ah-text-tertiary`), sumbu waktu 23.15 → 07.00.
- V1 (manual log): fase tidak tersedia → tampilkan bar durasi 7 hari + garis rata-rata; hipnogram hanya muncul jika ada data wearable (V3). **Jangan memalsukan data fase dari input manual.**
- `<BarSparkline />` generik: dipakai Activity & Heart Rate; tinggi 48px, tanpa sumbu, tooltip on-tap.

### 2.9 `<ProgramCard />`, `<NutritionSummary />`, `<VaultFolder />`

- **ProgramCard:** thumbnail + judul + durasi ("30 Hari") + progress bar tipis gradient + "21/30 hari". Program aktif = kartu besar hero; populer = list horizontal scroll (scroll-snap).
- **NutritionSummary:** 3 ring mini (Karbo/Protein/Lemak — warna nutrition dengan variasi) + progress kalori "1.650 / 2.000 kkal · sisa 350". Angka sisa adalah informasi utama, bukan persentase.
- **VaultFolder:** baris folder (ikon violet + nama + "12 Dokumen" + chevron). Sebelum konten Vault dirender → **App Lock interstitial** (biometrik/PIN) setiap kali, tanpa kecuali. Thumbnail dokumen di-blur sampai terautentikasi.

### 2.10 Komponen Pendukung

`<BottomNav />` (5 tab, ikon aktif diberi dot gradient + label; safe-area inset), `<StatusChip />` (Baik/Normal/dll., warna band), `<SheetModal />` (drag handle, snap 50/90%), `<EmptyState />` (ilustrasi Arta Bot pose berbeda per konteks + 1 CTA), `<SkeletonCard />` (shimmer gradient gelap), `<Toast />` (bawah, di atas nav; sukses = ✓ hijau + undo 5 detik untuk log), `<SyncBadge />`, `<StreakFlame />`.

---

## 3. Spesifikasi Per Layar

### 3.1 Beranda (Dashboard)

**Job layar:** dalam 3 detik user tahu "kondisi saya hari ini" dan bisa mencatat dalam 1 tap.

Struktur (atas → bawah):
1. **Header glass** (sticky): "Selamat pagi, Firman 👋" + sub "Semangat menjalani hari yang sehat!" + ikon lonceng (badge unread) + avatar. Sapaan berubah per waktu: pagi (04–10), siang (10–15), sore (15–18), malam (18–04). Malam hari sub-copy berubah: "Waktunya bersiap istirahat 🌙" — dashboard *sadar waktu*.
2. **InsightBanner** (dismissible).
3. **Hero Health Score**: HealthRing lg + angka Display + chip band + link "Detail →" (buka sheet breakdown: bar per parameter dari JSON `daily_scores.breakdown` — transparansi skor, sesuai prinsip "bisa dijelaskan").
4. **Grid 4 MetricCard**: Tidur · Aktivitas · Hidrasi · Kalori. (Kalori tampil "—" di V1 sebelum modul nutrition; tap → teaser "Hadir di update berikutnya".)
5. **AI Recommendation card** (dari prototipe): 1 rekomendasi actionable + chevron → tap = tambah sebagai habit hari ini ("Jalan kaki 20 menit sore" → masuk checklist). Rekomendasi harus selalu *bisa dieksekusi*, bukan nasihat umum.
6. **Kartu sekunder** (scroll): Sleep Analysis, Hydration, Activity, Heart Rate (Heart Rate hanya render bila ada data — jangan tampilkan kartu kosong permanen).

Empty state hari pertama: ring abu + "Skor pertama Anda muncul setelah 3 pencatatan" + 3 checklist onboarding (catat tidur, minum, mood) — gamifikasi sejak menit pertama.

### 3.2 Timeline

- Header: tanggal hari ini + HealthRing sm + tombol kalender (date picker → lompat tanggal).
- List TimelineItem virtual, infinite scroll ke belakang.
- Filter chip horizontal: Semua · Tidur · Makan · Aktivitas · Obat.
- Empty per hari: "Belum ada catatan hari ini" + CTA "+ Catat sesuatu".
- Pull-to-refresh = trigger sync manual.

### 3.3 AI Chat

- Layar penuh, header: avatar bot + "Arta" + status ("Siap membantu" / "Mengetik…").
- Sesi baru per hari (session_id harian) — konteks tetap dibawa dari data, bukan dari chat kemarin (hemat token, jelas mentalnya).
- Free tier: counter sisa kuota di header ("3 pertanyaan tersisa hari ini"); habis → chip berubah jadi CTA upgrade PRO yang sopan, input tetap terlihat tapi disabled dengan penjelasan — **jangan sembunyikan fitur, jelaskan batasnya**.
- Jawaban AI yang mengandung data (mis. "rata-rata tidur Anda 7j 12m") merender **kartu data inline** (mini chart) di dalam bubble — bukan hanya teks.

### 3.4 Program

- Hero: program aktif (progress + CTA "Lanjutkan Hari ke-22").
- "Program Populer": Weight Loss 28 Hari · Better Sleep 21 Hari · Stress Relief 14 Hari · Build Stamina 30 Hari (sesuai prototipe).
- Detail program: overview → jadwal harian → tiap hari = checklist task yang menulis ke habit engine (program = kumpulan habit ber-kurikulum; **tidak ada tabel baru**, reuse `habits` + tag `program_id`).
- Menyelesaikan hari = XP + streak; bolos 1 hari = program *pause*, bukan gagal (copy: "Tidak apa-apa, lanjutkan hari ini 💪") — desain memaafkan, melawan churn.

### 3.5 Food Diary (V2)

- Ringkasan Nutrisi (3 ring + kalori) di atas; list makanan per meal-type dengan foto thumbnail + kkal.
- FAB (+) → 3 pilihan: 📷 Foto (kamera langsung, bukan galeri dulu) · ⌨️ Manual (search TKPI dengan autocomplete) · ▦ Barcode.
- Alur foto: capture → preview + spinner "Arta mengenali makanan Anda…" (max 6 detik, lalu fallback manual) → hasil = kartu editable (nama, porsi slider, makro) + confidence rendah = "Ini Nasi Ayam? [Ya] [Koreksi]".
- Angka gizi selalu editable — AI mengusulkan, user memutuskan.

### 3.6 Medical Vault (V2)

- App Lock wajib di depan (3.2.9). Setelahnya: search bar (OCR AI Search) + folder per `doc_type` (Hasil Lab, Resep Dokter, MCU, Vaksin & Imunisasi, Radiologi, Asuransi & BPJS — sesuai prototipe).
- Upload: kamera/berkas → OCR berjalan background → dokumen langsung tampil dengan badge "Memproses…" → selesai = searchable.
- Detail dokumen: viewer + metadata + tombol share via **signed URL 60 detik** dengan konfirmasi eksplisit ("Tautan aktif 1 menit dan hanya bisa dibuka sekali").
- Empty state: ilustrasi + "Simpan hasil lab, resep, dan dokumen penting — terenkripsi dan hanya Anda yang bisa membuka."

### 3.7 Profil

Bagian: kartu profil + Health Level/XP → Family Health (avatar switcher horizontal) → Emergency Card (preview merah lembut + "Tampilkan di lockscreen" guide) → Pengaturan (target, notifikasi, tema, bahasa) → Keamanan (biometrik, PIN, ekspor data, hapus akun) → Langganan → Tentang.

**Emergency Card full-screen mode:** kontras maksimal, font besar, tombol brightness-max, QR berisi data darurat (offline-capable) — didesain untuk dibaca orang lain dalam kondisi panik.

### 3.8 Onboarding (5 langkah, < 90 detik)

1. Splash: logo + Health Ring animasi → 2. Value (3 slide swipe, skippable) → 3. Auth (Google 1-tap / email OTP) → 4. Data dasar: nama panggilan, tanggal lahir, tinggi, berat, target utama (pilihan kartu: Lebih Bugar · Tidur Lebih Baik · Turun Berat · Bangun Kebiasaan — menentukan bobot rekomendasi awal) → 5. Izin: notifikasi (dengan alasan: "untuk pengingat minum & tidur") + consent data (checkbox eksplisit per poin, sesuai UU PDP — **bukan satu checkbox borongan**).

Selesai → langsung ke Beranda dengan misi pertama, bukan tur panjang.

---

## 4. Motion & Micro-interaction Map

| Momen | Animasi | Durasi |
|---|---|---|
| Buka app / refresh skor | Ring sweep + count-up + haptic | 800 + 1200ms |
| Log air via FAB | FAB morph ✓ (spring) + gelas terisi + toast undo | 400ms |
| Skor naik vs kemarin | Confetti mikro sekali (≤ 12 partikel, area ring saja) | 600ms |
| Habit dicentang | Checkbox draw-on + StreakFlame pulse | 250ms |
| Tab switch | Cross-fade + slide 8px | 200ms |
| Kartu masuk viewport | Fade-up 12px, stagger 60ms, sekali saja | 300ms |
| Chat streaming | Token reveal + caret | realtime |
| Milestone streak (7/30/100) | Full-screen moment: bot + badge + share card | 1 kali per milestone |

Disiplin: **tidak ada animasi looping ambient** di dashboard (hemat baterai, kesan tenang). Boros motion hanya di Health Ring dan momen perayaan.

---

## 5. Sistem Copy (Microcopy Bahasa Indonesia)

**Tone:** teman yang peduli — hangat, spesifik, tidak menggurui, tidak klinis, tidak lebay.

| Prinsip | ❌ Hindari | ✅ Gunakan |
|---|---|---|
| Spesifik > pujian kosong | "Kerja bagus!" | "Tidur Anda naik 18 menit dari rata-rata minggu ini" |
| Tidak menghakimi | "Anda gagal mencapai target air" | "Masih ada 700 ml lagi menuju target — semangat!" |
| Error memberi arah | "Terjadi kesalahan" | "Belum tersambung ke internet. Catatan Anda aman dan akan tersinkron otomatis." |
| Aksi = kata kerja hasil | "Submit", "OK" | "Simpan Catatan", "Mulai Program" |
| Konsisten istilah | mix "log/catat/input" | selalu **"Catat"**; skor selalu **"Health Score"**; target selalu **"Target"** |
| Medis = hati-hati | "Anda mengalami insomnia" | "Pola tidur Anda lebih larut 3 hari terakhir — coba tips ini" |

Sapaan: "Anda" (kapital) untuk body; nama panggilan di header & chat. Emoji: maksimal 1 per pesan, hanya di konteks motivasi/perayaan, tidak pernah di konten medis/Vault/error.

---

## 6. Responsive, Platform & Aksesibilitas

- **Breakpoints:** 360 (baseline) · 430 (large phone: grid metrik tetap 4, padding naik) · ≥768 tablet/desktop: layout 2 kolom (dashboard kiri, detail/chat kanan) — nav pindah ke sidebar rail kiri. Prototipe panel kanan (Sleep/Hydration/Activity/Heart Rate cards) adalah preview layout desktop ini.
- **PWA:** splash & ikon maskable, `display: standalone`, safe-area (notch) untuk header & bottom nav, pull-to-refresh custom (bukan reload).
- **Aksesibilitas:** target sentuh ≥ 44px; fokus keyboard terlihat (ring 2px cyan); semua chart punya ringkasan teks (`aria-label`: "Tidur 7 jam 45 menit, kualitas baik"); status tidak pernah hanya warna (selalu + label); font-size mengikuti setelan OS hingga 130% tanpa layout pecah (test wajib).
- **Performa:** ilustrasi bot = SVG/Lottie ringan (< 40KB), foto makanan lazy + blur-hash, chart render di client tanpa lib berat (Recharts hanya di halaman detail, sparkline = SVG manual).

---

## 7. Mapping ke Technical Blueprint (Handoff Matrix)

| Komponen UI | Modul Domain | Sumber Data | Fase |
|---|---|---|---|
| HealthRing, Score Detail Sheet | `scoring` | `daily_scores` (+ realtime lokal) | V1 |
| InsightBanner, AI Recommendation | `insight` | `ai_insights` (cache harian) | V1 |
| MetricCard, QuickLogFAB, HydrationTracker | `vitals` | `*_logs` via outbox sync | V1 |
| TimelineItem | `timeline` | read-model agregat | V1 |
| ChatBubble + Safety UI | `insight` + AI Gateway | `ai_chat_messages` | V1 |
| ProgramCard, checklist | `habits` (+ tag program) | `habits`, `habit_completions` | V1–V2 |
| NutritionSummary, Food capture flow | `nutrition` | `food_logs` + TKPI ref | V2 |
| VaultFolder + App Lock | `vault` | `medical_documents` (enc) | V2 |
| Emergency Card screen | `identity` | `emergency_cards` (enc) | V1 |
| StreakFlame, XP, milestone moment | `gamification` | `player_stats` | V2 |
| Family switcher | `family` | `profiles` | V2 |

---

## 8. Urutan Pengerjaan Design System (Sprint Desain)

1. **Minggu 1:** token file (CSS vars + Tailwind preset) → HealthRing → MetricCard → BottomNav → SheetModal → Toast/Skeleton/EmptyState. *Storybook untuk semua state.*
2. **Minggu 2:** Beranda lengkap (dark) → QuickLogFAB + alur log air end-to-end → light mode pass.
3. **Minggu 3:** Timeline + Chat (termasuk disclaimer & red-flag UI) → onboarding.
4. **Minggu 4:** Program + Profil + Emergency Card → audit aksesibilitas + reduced-motion + font-scaling → freeze v1 design system.

**Definition of Done per komponen:** 5 state terimplementasi · dark+light · 360px & 430px · reduced-motion · aria lengkap · terdokumentasi di Storybook · zero hex hardcoded.

---

## 9. Anti-Pattern yang Dilarang (Guardrail Desain)

1. ❌ Menampilkan data yang tidak ada (fase tidur palsu dari log manual, HR tanpa sensor).
2. ❌ Skor turun ditampilkan dengan warna/copy menghukum — selalu framing "area fokus", bukan kegagalan.
3. ❌ Dialog konfirmasi untuk aksi yang bisa di-undo (log air, centang habit) — pakai toast undo.
4. ❌ Gradient di lebih dari 2 elemen per layar (hero ring + 1 banner max).
5. ❌ Notifikasi push generik ("Jangan lupa buka aplikasi!") — setiap push harus berisi data personal atau tidak dikirim sama sekali.
6. ❌ Menyembunyikan fitur PRO — selalu tampilkan dengan penjelasan nilai + batas yang jelas.
7. ❌ Konten medis/Vault muncul di screenshot switcher OS — aktifkan `FLAG_SECURE`-equivalent (blur on background) untuk layar Vault & Emergency.

---

*Spesifikasi ini melengkapi Technical Blueprint v1.0-TB. Prototipe visual adalah kebenaran arah; dokumen ini adalah kebenaran eksekusi. Jika keduanya bertentangan saat implementasi, putuskan lewat prinsip: kejelasan data > estetika, kecepatan mencatat > kelengkapan form, kejujuran data > kesan canggih.*
