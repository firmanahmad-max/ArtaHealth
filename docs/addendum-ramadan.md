# ArtaHealth — Addendum 2: Mode Ramadan & Puasa

### Spesifikasi Modul Kesehatan Sadar-Puasa (Fasting-Aware Health)

**Version:** 1.0-RM (Addendum untuk Technical Blueprint v1.0-TB, UI/UX Spec v1.0-DS, Addendum SK v1.0-SK)
**Owner:** Arta Ecosystem — Firman Ahmad
**Deadline keras:** Live di production sebelum 1 Sya'ban 1448 H (± pertengahan Januari 2027) — fitur Ramadan yang rilis saat Ramadan sudah berjalan kehilangan sebagian besar nilainya.

---

## 1. Rasional Produk

### 1.1 Masalah

Semua aplikasi kesehatan global "rusak" selama Ramadan bagi ±230 juta Muslim Indonesia:

- Pengingat minum berbunyi jam 13.00 saat user sedang berpuasa.
- Skor tidur anjlok karena bangun sahur dianggap "tidur terfragmentasi yang buruk".
- Target kalori dan jadwal makan tidak mengenal sahur dan iftar.
- Streak dan skor menghukum perubahan pola yang justru sedang dijalani dengan penuh kesadaran.

Hasilnya: user Muslim **meninggalkan aplikasi kesehatan selama sebulan penuh** — bulan dengan perubahan pola hidup paling drastis, saat pendampingan justru paling dibutuhkan. Churn Ramadan adalah fenomena nyata di aplikasi habit/health global.

### 1.2 Posisi ArtaHealth

Mode Ramadan menjadikan ArtaHealth satu-satunya health companion yang *memahami* puasa, bukan sekadar mentolerirnya. Ini diferensiator identitas yang selaras dengan DNA produk Firman (HariBaik, esai Celestial Internet) dan sulit ditiru pemain global karena butuh pemahaman kultural, bukan sekadar fitur.

**Batas lingkup (penting):** ArtaHealth menangani sisi **kesehatan** dari puasa (hidrasi, tidur, nutrisi, aktivitas, keamanan medis). Sisi **spiritual** (target ibadah, tadarus, tarawih) adalah domain **HariBaik** — brand terpisah di luar Arta Ecosystem. Keduanya bersinergi lewat integrasi opt-in (§8), tidak saling mencaplok lingkup.

---

## 2. Prinsip Desain

1. **Puasa bukan anomali, melainkan konteks.** Selama mode aktif, seluruh engine (hydration, sleep, scoring, habit, reminder) membaca konteks hari-puasa — bukan menambal dengan pengecualian di UI.
2. **Tidak pernah menghakimi status puasa.** User bisa menandai "tidak puasa hari ini" **tanpa ditanya alasannya** — uzur (haid, sakit, safar, menyusui) adalah privasi. Streak dan skor tidak menghukum hari tidak-puasa selama Ramadan.
3. **Keselamatan di atas segalanya.** Kondisi kronis + puasa adalah wilayah sensitif; semua guidance mengarah ke konsultasi dokter, dan aplikasi mengingatkan bahwa Islam memberikan keringanan (rukhsah) bagi yang sakit — pesan yang menenangkan, bukan menggurui.
4. **Deterministik dulu, AI kemudian.** Kalibrasi ulang skor, jendela hidrasi, dan jadwal reminder adalah aturan deterministik. AI hanya menarasikan dan memberi tips kontekstual.
5. **Skor Ramadan tetap sebanding dan jujur.** Skor selama mode puasa diberi penanda visual (🌙) dan dihitung dengan normalisasi berbeda — tren tahunan tidak boleh terdistorsi diam-diam.

---

## 3. Lingkup Fitur

### 3.1 Ramadan (fitur inti)

| Fitur | Deskripsi |
|---|---|
| **Aktivasi mode** | Kartu ajakan muncul menjelang Ramadan ("Ramadan sebentar lagi — siapkan mode puasa?"). Tanggal mulai **dikonfirmasi user** (Indonesia menentukan via sidang isbat; aplikasi tidak boleh sok tahu). Prompt malam ke-29: "Apakah besok mulai puasa?" |
| **Jadwal imsakiyah lokal** | Waktu imsak, subuh, dan maghrib dihitung client-side per lokasi (offline-capable) dengan parameter Kemenag + opsi koreksi manual ±menit. Menjadi dasar seluruh jendela waktu. |
| **Smart Hydration — jendela buka→imsak** | Target harian tetap (35ml/kg), tapi pengingat terdistribusi dalam jendela: pola anjuran 2-4-2 (2 gelas saat berbuka, 4 malam hari, 2 saat sahur). Pengingat siang hari otomatis senyap. Gelas di HydrationTracker diberi label sesi. |
| **Smart Sleep — sadar sahur** | Tidur malam + tidur setelah subuh + qailulah (tidur siang singkat) dihitung **agregat**; bangun sahur tidak dihukum sebagai fragmentasi. Baseline konsistensi di-reset ke baseline Ramadan sendiri. Insight: "Total istirahat Anda 6j 40m dari 2 sesi — cukup baik untuk hari puasa." |
| **Aktivitas — timing cerdas** | Target langkah dikalibrasi (default 70%). Rekomendasi waktu olahraga: ringan menjelang berbuka atau setelah isya/tarawih — tidak pernah menyarankan olahraga berat siang hari puasa. Terhubung AQI-aware jika fitur itu hadir. |
| **Food Diary — sahur & iftar** | Meal type berubah: `sahur`, `iftar`, `malam`. Insight nutrisi khusus (hindari makan berlebih saat berbuka, protein & serat saat sahur, kurangi gorengan — disajikan sebagai tips, bukan larangan). |
| **Health Score 🌙** | Kalibrasi ulang deterministik (lihat §5). Ring diberi badge bulan sabit kecil. |
| **Countdown berbuka & pengingat sahur** | Header Beranda menampilkan "Berbuka 18.24 · 3j 12m lagi" saat berpuasa; notifikasi sahur configurable (default 60 menit sebelum imsak) dengan konten berguna (sisa target air + saran menu sahur), bukan sekadar alarm. |
| **Status harian tanpa interogasi** | Toggle diam-diam di Timeline: "Hari ini: Puasa ✓ / Tidak". Default "Puasa" selama Ramadan. Memilih "Tidak" → semua engine kembali ke mode normal untuk hari itu, tanpa pertanyaan, tanpa efek ke streak Ramadan (dihitung dari hari-hari puasa saja). |

### 3.2 Puasa Sunnah (sepanjang tahun — nilai retensi 11 bulan lainnya)

- Jadwal opt-in: **Senin–Kamis**, **Ayyamul Bidh** (13–15 Hijriah), **6 hari Syawal**, **Arafah**, **Tasu'a–Asyura**, **Puasa Daud**.
- User memilih jadwal yang diikuti → malam sebelumnya muncul pengingat lembut ("Besok Kamis — jadwal puasa sunnah Anda. Aktifkan mode puasa?") → jika dikonfirmasi, seluruh engine hari itu berjalan dalam konteks puasa.
- Kalender Hijriah ditampilkan berdampingan di Timeline selama fitur aktif.

### 3.3 Keamanan Medis Puasa (sinergi Silent Killer Guard) — pembeda paling serius

| Skenario | Perilaku aplikasi |
|---|---|
| **Aktivasi mode + `monitored_conditions` berisi diabetes/hipertensi** | Interstitial edukasi satu kali: "Puasa dengan kondisi Anda umumnya mungkin, namun jadwal obat dan pemantauan perlu disesuaikan — **diskusikan dengan dokter sebelum Ramadan**." + CTA membuat reminder "Konsultasi pra-Ramadan". |
| **Jadwal obat jatuh di jam puasa** | Medicine Reminder mendeteksi konflik: "Jadwal obat 13.00 Anda jatuh di jam puasa. Diskusikan penyesuaian dengan dokter/apoteker, lalu perbarui jadwalnya di sini." Aplikasi **tidak pernah** menyarankan waktu/dosis baru sendiri. |
| **Red-flag hipoglikemia saat berpuasa** (GDS < 70, atau gejala dicatat) | Kartu darurat diperluas: penanganan segera + kalimat rukhsah yang menenangkan: "Keselamatan adalah prioritas — Islam memberikan keringanan berbuka bagi kondisi darurat medis. Segera tangani, lalu hubungi tenaga medis." |
| **Anjuran cek gula darah** | Edukasi bahwa memeriksa gula darah tidak membatalkan puasa (pandangan umum yang mapan) — menurunkan hambatan monitoring justru di periode paling berisiko. |
| **Tensi/gula zona merah berturut selama Ramadan** | AI Insight memprioritaskan anjuran konsultasi, bukan tips gaya hidup. |

Seluruh konten §3.3 wajib melewati review tenaga medis + satu pemeriksa konten keislaman sebelum rilis (checklist §10).

---

## 4. Model Data (tambahan migration)

```sql
-- Konfigurasi mode puasa per profil
create table fasting_settings (
  profile_id       uuid primary key references profiles(id),
  ramadan_enabled  boolean not null default false,
  ramadan_start    date,                    -- dikonfirmasi user (sidang isbat)
  ramadan_end      date,
  sunnah_schedules text[] not null default '{}',
                   -- {senin_kamis, ayyamul_bidh, syawal6, arafah, asyura, daud}
  sahur_reminder_min int not null default 60,   -- menit sebelum imsak
  time_correction  jsonb not null default '{"imsak":0,"maghrib":0}', -- koreksi manual ±menit
  medical_ack_at   timestamptz,             -- timestamp interstitial medis di-acknowledge
  updated_at       timestamptz not null default now()
);

-- Status puasa per hari (sumber kebenaran untuk semua engine)
create table fasting_days (
  profile_id   uuid not null references profiles(id),
  date         date not null,
  fasting_type text not null,               -- ramadan|senin_kamis|ayyamul_bidh|syawal|arafah|asyura|daud|qadha|nazar
  status       text not null default 'fasting',  -- fasting|not_fasting  (TANPA kolom alasan — by design, privasi)
  confirmed    boolean not null default false,   -- true jika user konfirmasi eksplisit
  primary key (profile_id, date)
);

create index idx_fasting_profile_date on fasting_days (profile_id, date desc);
```

**Keputusan teknis:**
- **Waktu salat/imsak dihitung di client** (library perhitungan astronomis, parameter Kemenag: Subuh 20°, Isya 18°) dari koordinat profil — offline-capable, tanpa dependensi API eksternal di jalur kritis. Koreksi manual disimpan di `fasting_settings`.
- **Kalender Hijriah**: konversi tabular untuk tampilan; tanggal-tanggal krusial (awal Ramadan, Syawal) **selalu dikonfirmasi user**, tidak pernah dipaksa dari konversi.
- `fasting_days` adalah **satu-satunya sumber kebenaran** status puasa. Semua engine (scoring, hydration, reminder, habit) membaca tabel ini — tidak ada flag puasa tersebar di tempat lain.
- Tabel ini juga menampung **qadha & nazar** — user yang mengganti puasa di luar Ramadan mendapat konteks engine yang sama.

---

## 5. Kalibrasi Health Score (update Blueprint §4)

Pada hari dengan `fasting_days.status = 'fasting'`, normalisasi sub-skor berubah; **bobot tetap** (30/20/25/10/15) agar arsitektur tidak bercabang:

| Sub-skor | Normal | Hari puasa |
|---|---|---|
| **S_sleep** | Durasi 7–9 jam kontinu + konsistensi ±45 mnt | **Agregat semua sesi** (malam + pasca-subuh + qailulah); rentang sehat 6–9 jam agregat; konsistensi diukur terhadap baseline Ramadan sendiri (rolling 7 hari sejak mode aktif) |
| **S_hydration** | `min(intake/target,1)×100` sepanjang hari | Target sama, dihitung dalam **jendela buka→imsak**; bonus distribusi: intake yang tersebar ≥3 sesi mendapat skor penuh lebih mudah daripada menumpuk sekali minum (mendorong pola 2-4-2) |
| **S_activity** | Langkah/8.000 + menit olahraga | Target langkah ×0,7; menit olahraga dihitung penuh hanya di jendela aman (±2 jam sebelum maghrib s.d. imsak) — aktivitas berat siang hari tetap dicatat tapi tidak "dipuji" engine |
| **S_mood** | mood×20 | Tidak berubah |
| **S_habit** | % habit selesai | Habit ber-tag `fasting_incompatible` (mis. "minum air tiap 2 jam") otomatis dijeda dan keluar dari penyebut — tidak dihitung gagal |

- `daily_scores.breakdown` mendapat field `"context": "fasting"` → UI merender badge 🌙 pada ring & riwayat; grafik tren tahunan memberi shading tipis pada periode Ramadan.
- Hari `not_fasting` di tengah Ramadan → normalisasi normal berlaku, tanpa komentar apa pun dari AI kecuali user bertanya.
- Unit test scoring engine bertambah satu suite penuh: `scoring-fasting.test.ts` (wajib 100% coverage, sama seperti engine dasar).

---

## 6. UI/UX (update Spec v1.0-DS)

1. **Header Beranda saat berpuasa:** baris kedua sapaan berganti menjadi countdown — "🌙 Berbuka 18.24 · 3j 12m lagi" (tabular-nums, update per menit). Setelah maghrib: "Selamat berbuka! Awali dengan air putih 💧" (CTA one-tap log air). Setelah isya kembali normal.
2. **HydrationTracker mode jendela:** deretan gelas dikelompokkan tiga sesi berlabel kecil (Berbuka · Malam · Sahur); gelas sesi yang belum tiba waktunya tampil redup.
3. **Badge 🌙 pada HealthRing** (12px, pojok kanan-atas ring) + tooltip "Skor hari puasa — dikalibrasi khusus".
4. **Toggle status puasa:** chip diam di header Timeline ("Puasa ✓"), tap → switch tanpa dialog, tanpa pertanyaan. Perubahan langsung berlaku ke engine hari itu.
5. **Tema visual:** aksen gradien bergeser halus ke arah `--ah-purple` yang lebih dominan + aksen amber hangat saat jam berbuka; **tanpa ornamen religius berlebihan** — elegan, bukan kartu ucapan. Ikon konsisten: 🌙 untuk konteks puasa, tidak dicampur simbol lain.
6. **Notifikasi (mematuhi guardrail #5 spec — selalu berisi data personal):**
   - Sahur: "Sahur dalam 60 menit. Sisa target air Anda 750 ml — sempatkan 2 gelas + menu berprotein."
   - Jelang berbuka (opsional): "30 menit lagi berbuka. Siapkan air putih dulu, ya."
   - Tidak ada notifikasi generik "Jangan lupa puasa!".
7. **Onboarding mode (3 layar, < 30 detik):** konfirmasi lokasi & cek waktu imsakiyah (+koreksi) → preferensi pengingat sahur → (kondisional) interstitial medis §3.3. Selesai → Beranda langsung berubah konteks.
8. **Microcopy — kalibrasi tone (melengkapi Spec §5):**
   - ❌ "Anda gagal minum cukup air hari ini" → ✅ "Jendela hidrasi Anda dibuka saat berbuka — targetnya tetap tercapai kok, asal dicicil."
   - ❌ "Tidur Anda terfragmentasi" → ✅ "Total istirahat 6j 40m dari 2 sesi — cukup baik untuk hari puasa."
   - ❌ (pada hari tidak puasa) komentar apa pun → ✅ diam; engine kembali normal tanpa narasi.

---

## 7. Gamification (update modul `gamification`)

- **Streak puasa Ramadan** terpisah dari streak habit umum, dihitung **hanya dari hari berstatus `fasting`** — hari `not_fasting` bukan pemutus streak, melainkan transparan (streak "28/29 hari puasa" adalah pencapaian, bukan kecacatan).
- Badge musiman: "Ramadan Pertama Bersama Arta", "Hidrasi Terjaga 30 Hari 🌙", "Sahur Konsisten". Badge **tidak pernah** dibuat untuk hal yang menyentuh uzur.
- Milestone khatam Ramadan (hari terakhir): momen layar penuh + ringkasan kesehatan sebulan ("Selama Ramadan: rata-rata tidur 6j 50m, hidrasi tercapai 26 hari, 142 ribu langkah") + share card Idulfitri.

---

## 8. Integrasi HariBaik (opt-in, lintas brand)

HariBaik = brand mandiri; integrasi berbentuk **pertukaran event ber-consent**, bukan penyatuan:

| Arah | Event | Nilai |
|---|---|---|
| ArtaHealth → HariBaik | `fasting_day_completed` | HariBaik bisa menampilkan afirmasi/apresiasi spiritual |
| HariBaik → ArtaHealth | `sahur_time_preference`, jadwal ibadah malam | Pengingat tidur ArtaHealth sadar jadwal tarawih/tahajud (tidak menyuruh tidur jam 21.00 saat user tarawih) |
| Keduanya | Kalender Hijriah & tanggal konfirmasi Ramadan | Konsistensi tanggal antar aplikasi |

Format event mengikuti pola `ecosystem_events` (Blueprint §9) dengan consent record terpisah per arah.

---

## 9. Penempatan Roadmap & Estimasi

| Sprint | Isi | Durasi |
|---|---|---|
| RM-1 | `fasting_settings` + `fasting_days` + engine waktu imsakiyah client-side + toggle status | 1 minggu |
| RM-2 | Kalibrasi scoring (suite test penuh) + hydration jendela + sleep agregat | 1,5 minggu |
| RM-3 | UI: countdown, tracker sesi, badge 🌙, onboarding mode, notifikasi | 1,5 minggu |
| RM-4 | Keamanan medis (§3.3) + puasa sunnah + gamification + review konten (medis & keislaman) | 1,5 minggu |
| RM-5 | Beta internal (uji dengan puasa sunnah Senin–Kamis sungguhan — dogfooding nyata sebelum Ramadan) | 1 minggu |

**Total ±6,5 minggu.** Mundur dari deadline 1 Sya'ban 1448 (± pertengahan Jan 2027): pengerjaan paling lambat mulai akhir November 2026 — realistis setelah V1 + V1.5 (Silent Killer Guard). Penempatan resmi: **V2, work-stream prioritas pertama**.

Catatan strategis: fitur **puasa sunnah** dirilis bersamaan (bukan menyusul) — ia adalah sarana *dogfooding* mingguan dan menjaga fitur tetap hidup 11 bulan di luar Ramadan.

---

## 10. Checklist Pra-Rilis

- [ ] Verifikasi perhitungan waktu imsak/maghrib vs jadwal imsakiyah Kemenag untuk ≥5 kota (termasuk Samarinda) — toleransi ±2 menit, sediakan koreksi manual
- [ ] Review konten medis-puasa (§3.3) oleh tenaga medis
- [ ] Review konten & istilah keislaman oleh pemeriksa yang kompeten (framing rukhsah, penamaan puasa sunnah, tidak ada klaim fikih yang melampaui yang mapan)
- [ ] Uji privasi: pastikan tidak ada jalur UI/analytics/log yang menyimpan atau menanyakan alasan `not_fasting`
- [ ] Uji notifikasi lintas zona waktu (WIB/WITA/WIT) & saat offline
- [ ] Suite `scoring-fasting.test.ts` 100% coverage, termasuk kasus hari campuran (mulai puasa → batal siang hari)
- [ ] Konfirmasi copy Idulfitri & share card oleh Firman (suara brand)

---

## 11. Ringkasan Perubahan pada Dokumen Sebelumnya

| Dokumen | Perubahan |
|---|---|
| Technical Blueprint §1.3 | + tanggung jawab `vitals`/`scoring`/`habits` membaca konteks `fasting_days`; modul lintas: `fasting` (config + kalender) |
| Technical Blueprint §3 | + tabel `fasting_settings`, `fasting_days` |
| Technical Blueprint §4 | + normalisasi hari puasa (§5 dokumen ini) + suite test baru |
| Technical Blueprint §12 | V2 dimulai dengan work-stream Mode Ramadan (deadline-driven) |
| UI/UX Spec §2–3 | + countdown header, HydrationTracker sesi, badge 🌙, toggle status, onboarding mode |
| UI/UX Spec §5 | + pola microcopy puasa (§6.8) |
| UI/UX Spec §9 (anti-pattern) | + #8: dilarang menanyakan/menyimpan alasan tidak puasa; + #9: dilarang notifikasi religius generik tanpa data personal |
| Addendum SK §2.6 | Safety Guard + konteks puasa pada red-flag hipoglikemia |

---

*Mode Ramadan adalah fitur di mana identitas Firman, kebutuhan pasar Indonesia, dan arsitektur ArtaHealth bertemu di satu titik. Dikerjakan dengan hormat — kepada penggunanya dan kepada ibadahnya — fitur ini bukan sekadar diferensiator, melainkan alasan orang merekomendasikan ArtaHealth ke keluarganya menjelang Ramadan.*
