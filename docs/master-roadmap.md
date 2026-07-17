# ArtaHealth — Peta Prioritas Terpadu (Master Roadmap)

### Konsolidasi PRD v1.0 + Blueprint + 3 Addendum + Fitur Terpilih → Satu Urutan Eksekusi

**Version:** 1.0-MR
**Owner:** Arta Ecosystem — Firman Ahmad
**Tanggal susun:** 12 Juli 2026
**Fungsi dokumen:** satu-satunya sumber kebenaran urutan pengerjaan. Semua dokumen lain menjelaskan *apa & bagaimana*; dokumen ini menjawab *kapan & kenapa duluan*. **Ini juga pertahanan resmi terhadap scope creep.**

---

## 1. Prinsip Prioritisasi

Setiap fitur dinilai dengan empat kriteria, urutan kepentingannya:

1. **Deadline alam** — Ramadan tidak bisa dijadwal ulang. Fitur bermusim mengalahkan segalanya di jendelanya.
2. **Dependensi data & teknis** — fitur yang butuh data historis (Early Warning) atau infrastruktur bersama (waktu salat, pipeline vision) ditempatkan setelah fondasinya ada.
3. **Nilai kepercayaan** — di aplikasi kesehatan, fitur yang paling jarang salah dibangun lebih dulu (scanner label sebelum foto masakan; klasifikasi deterministik sebelum prediksi).
4. **Nilai monetisasi & retensi** — PRO diluncurkan tepat sebelum momen nilai tertinggi (Ramadan).

**Aturan kapasitas (tidak bisa ditawar):**
- Asumsi: 1 developer (Firman) + AI coding tools, ±30 jam produktif/minggu di sela Max Computer. **Jika kapasitas nyata setengahnya, seluruh timeline bergeser — kecuali jangkar Ramadan: yang dikorbankan adalah fitur lain, bukan deadline Ramadan.**
- **Maksimal 1 work-stream besar aktif** pada satu waktu + boleh 1 fitur mikro (≤3 hari).
- Fitur baru yang muncul di tengah jalan masuk **Backlog (§6)**, tidak menyela stream aktif. Satu-satunya pengecualian: bug keselamatan.

---

## 2. Kalender Strategis (Jangkar Waktu)

| Jangkar | Perkiraan tanggal | Implikasi |
|---|---|---|
| **1 Sya'ban 1448 H** | ± 9–10 Januari 2027 | Mode Ramadan wajib LIVE sebelum ini |
| **1 Ramadan 1448 H** | ± 8 Februari 2027 (menunggu isbat) | Feature freeze; puncak penggunaan |
| **Idulfitri 1448 H** | ± 10 Maret 2027 | Momen "Ramadan Wrapped" + share card |
| Hari ini | 12 Juli 2026 | Runway ke deadline Ramadan: ±26 minggu |

Runway 26 minggu untuk V1 (8) + V1.5 (4) + Mode Ramadan (7) = 19 minggu kerja + **7 minggu cadangan total**. Cukup — asal disiplin.

---

## 3. Roadmap Ter-sequence

### 🏗️ FASE 1 — V1 Fondasi *(14 Jul – 11 Sep 2026, 8 mgg + 1 mgg buffer)*

Sesuai Blueprint §12 Sprint 1–6, tanpa tambahan apa pun:

| Isi | Sumber |
|---|---|
| Monorepo, Supabase, CI/CD, design system inti (HealthRing dkk.) | Blueprint |
| Auth + onboarding + profil | PRD/Blueprint |
| Logging offline-first: hidrasi, tidur, aktivitas, mood, berat + sync engine | PRD/Blueprint |
| Scoring engine (test 100%) + Dashboard + Timeline | PRD/Blueprint |
| Habit engine + streak | PRD/Blueprint |
| AI Gateway + Safety Guard + Daily Insight + AI Chat (kuota free) | Blueprint |
| PWA polish + push notification | Blueprint |

**Gate keluar:** dogfooding pribadi 7 hari penuh · zero critical error 1 minggu · log air < 2 detik terverifikasi.

---

### 🛡️ FASE 2 — V1.5 Silent Killer Guard *(14 Sep – 9 Okt 2026, 4 mgg)*

| Isi | Sumber |
|---|---|
| `biomarker_bands` + engine klasifikasi (tensi, gula) + Risk Panel + trend pita zona + red-flag flow | Addendum SK |
| 🎁 Mikro: **Pengingat hak skrining BPJS/Posbindu/Prolanis** (konten statis + reminder — ≤3 hari) | Ide #9 |

**Gate keluar:** review tenaga medis selesai · red-flag flow teruji offline.
**🚀 Soft launch publik: pertengahan Oktober 2026** — produk mulai mengumpulkan user & data baseline (penting untuk Early Warning nanti).

---

### 🌙 FASE 3 — V2-A Mode Ramadan *(12 Okt – 27 Nov 2026, 6,5 mgg + buffer)*

| Isi | Sumber |
|---|---|
| Sprint RM-1 s.d. RM-5 lengkap (fasting engine, kalibrasi skor, UI, keamanan medis, puasa sunnah) | Addendum RM |
| 🎁 **Habit Anchoring Waktu Salat** — menumpang infrastruktur waktu salat RM-1; jadwal habit ber-anchor salat, opt-in (±0,5 mgg, masuk RM-3) | Ide terpilih #3 |
| **Medicine Reminder dasar** *(1–11 Des, setelah stream RM)* — CRUD obat + jadwal + reminder; prasyarat deteksi konflik obat-puasa (RM §3.3) | PRD V2, dimajukan |

**Dogfooding nyata:** Firman & beta tester memakai mode puasa untuk Senin–Kamis sepanjang November–Desember.
**Desember 14–31:** hardening, uji lintas zona waktu, review konten keislaman & medis, buffer libur akhir tahun.
**Gate keluar: Mode Ramadan LIVE ≤ 5 Januari 2027** (sebelum 1 Sya'ban).

---

### 💰 FASE 4 — PRO Launch + Sadar Gizi Inti *(4 Jan – 5 Feb 2027, 4,5 mgg)*

| Isi | Sumber |
|---|---|
| **Billing PRO (Midtrans/QRIS)** + paywall server-side + **promo "Paket Ramadan" tahunan** — diluncurkan di puncak nilai | Blueprint §11 |
| **Sadar Gizi INTI** (NG-1 s.d. NG-3 dipadatkan): pindai label → verdict personal + GGL Budget + integrasi Food Diary. *Multi-profil keluarga & bandingkan produk ditunda ke Fase 6* | Addendum NG |

Alasan penempatan: belanja pangan kemasan memuncak menjelang & selama Ramadan (sirup, biskuit, minuman berbuka) — scanner hadir tepat saat paling dibutuhkan, sekaligus jadi fitur PRO showcase.
**Gate keluar:** akurasi ekstraksi ≥95% pada korpus ≥100 label riil · alergen ber-disclaimer teruji.

---

### 🕌 FASE 5 — Ramadan Live-Ops *(± 8 Feb – 10 Mar 2027)*

**FEATURE FREEZE.** Hanya: perbaikan bug, tuning notifikasi, dukungan user, observasi metrik. Siapkan **"Ramadan Wrapped"** (read-model + share card, ≤4 hari kerja, rilis H-3 Idulfitri).
Ini juga periode belajar terpenting setahun — semua insight masuk backlog ber-tag `ramadan-2027-learning`.

---

### 🚀 FASE 6 — V2-B Ekspansi *(Apr – Jul 2027, urutan di dalam fase boleh disesuaikan)*

| Urutan | Fitur | Sumber | Catatan |
|---|---|---|---|
| 1 | **Medical Vault + OCR → auto-extract biomarker** | PRD V2 + Addendum SK | Membuka killer feature lab-ke-grafik |
| 2 | **Family Health penuh** + Sadar Gizi multi-profil + Mode Lansia/Caregiver dasar | PRD V2 + NG + Ide #3 lama | Pendorong PRO terkuat |
| 3 | **Cek Nadi via Kamera (rPPG)** | Ide terpilih #1 | Riset spike 1 mgg dulu (akurasi WebAssembly di device kelas menengah); jika lolos → 3 mgg build; disclaimer ketat |
| 4 | **Early Warning (anomali baseline)** | Ide terpilih #2 | *Sengaja di sini:* butuh ≥30–60 hari data baseline user — yang baru tersedia setelah soft launch Oktober berjalan berbulan-bulan. Deterministik (z-score), test penuh |
| 5 | Food Diary AI (foto masakan) + Perencana Menu sisa anggaran GGL | PRD V2 + Ide #5 | Setelah kepercayaan "AI gizi" terbangun via scanner |
| 6 | Gamification penuh (XP, badge, mission) | PRD | |

---

### 🔭 FASE 7 — V3 *(H2 2027)*

Health Connect/wearables → Mode Konsultasi QR + Laporan untuk Dokter → Cek Klaim Kesehatan (anti-hoaks, sinergi ArtaBot) → Simulasi "Bagaimana Jika" → Kesehatan Siklus → Jadwal Imunisasi Anak → AI korelasi lintas-metrik & report bulanan.

---

## 4. Peta Fitur → Fase (Master Index)

| Fitur | Fase | Status dokumen |
|---|---|---|
| Dashboard, Score, Timeline, Hydration, Sleep, Activity, Habit, Insight, Chat | 1 | Blueprint ✅ |
| Silent Killer Guard (tensi+gula) | 2 | Addendum SK ✅ |
| Pengingat skrining BPJS/Prolanis | 2 | Perlu spec mikro |
| Mode Ramadan + puasa sunnah | 3 | Addendum RM ✅ |
| Habit Anchoring Salat | 3 | Perlu spec mikro |
| Medicine Reminder dasar | 3 | Blueprint (skema ada) |
| Billing PRO + Paket Ramadan | 4 | Blueprint §11 |
| Sadar Gizi inti | 4 | Addendum NG ✅ |
| Ramadan Wrapped | 5 | Perlu spec mikro |
| Medical Vault + OCR→biomarker | 6 | Addendum SK §2.5 |
| Family penuh + Mode Lansia | 6 | Perlu addendum |
| Cek Nadi rPPG | 6 | **Perlu addendum + riset spike** |
| Early Warning | 6 | **Perlu addendum** |
| Food AI + Perencana Menu | 6 | PRD + NG §7 |
| Lipid & asam urat (manual + via Vault OCR) | 6 | Addendum SK |
| Radar Sehat (AQI/heat/DBD) | 6–7 | Backlog spec |
| Semua item V3 | 7 | PRD V3/V4 |

## 5. Gerbang Keputusan (Checkpoint)

| Kapan | Pertanyaan | Jika gagal |
|---|---|---|
| Akhir Fase 1 | Apakah saya sendiri memakai ini tiap hari? | Perbaiki core loop dulu — jangan lanjut fitur |
| Akhir Fase 2 (soft launch +4 mgg) | ≥100 user aktif mingguan organik/ajakan? Retensi D7 ≥25%? | Lanjutkan Ramadan (deadline), tapi tunda Fase 4 monetisasi → fokus retensi |
| Sebelum Fase 4 | Willingness to pay tervalidasi (survey/waitlist PRO)? | Luncurkan PRO tetap, tapi harga eksperimen |
| Akhir Fase 5 | Metrik Ramadan: retensi selama puasa vs sebelum? | Menentukan bobot investasi fitur kultural di V3 |
| Sebelum rPPG build | Spike: akurasi ±10 bpm di ≥3 device uji? | Batalkan tanpa rasa bersalah — pindah ke wearable V3 |

## 6. Backlog Resmi (Diparkir dengan Sadar)

Cek Klaim Kesehatan · Simulasi What-If · Radar Sehat · Mode Konsultasi QR · Kesehatan Siklus · Imunisasi Anak · Katalog produk komunal · SATUSEHAT · Leaderboard · Voice via Arta Assistant · Wearable penuh · ArtaBot quick-log*

\* *ArtaBot quick-log sengaja di backlog meski effort kecil: ia membuka permukaan keamanan baru (auth via chat) dan kanal support kedua — layak dikerjakan saat produk inti stabil, kandidat kuat sisipan mikro di Fase 6.*

**Aturan backlog:** ide baru ditulis di sini dengan satu kalimat + tag fase kandidat. Ditinjau hanya di pergantian fase. Tidak ada "sekalian aja mumpung ingat".

## 7. Apa yang TIDAK Dikerjakan (Pernyataan Eksplisit)

Hingga akhir Fase 5 (Idulfitri 2027), ArtaHealth **tidak** mengerjakan: integrasi wearable, voice assistant, leaderboard sosial, katalog komunal, konsultasi dokter dalam-app, konten video program, aplikasi native (tetap PWA), dan fitur apa pun yang tidak tercantum di Fase 1–5. Setiap godaan dicatat ke §6 lalu dilupakan sampai checkpoint.

---

## 8. Ringkasan Satu Layar

```
2026  Jul───Sep : V1 Fondasi (core loop + AI insight)          ── dogfood
      Sep───Okt : V1.5 Silent Killer Guard                     ── 🚀 soft launch
      Okt───Des : V2-A Mode Ramadan + Anchoring Salat + Obat   ── deadline-driven
2027  Jan       : LIVE Ramadan Mode (≤5 Jan) → PRO + Paket Ramadan
      Jan───Feb : Sadar Gizi inti                              ── sebelum 1 Ramadan
      Feb───Mar : 🕌 RAMADAN — freeze, live-ops, Wrapped
      Apr───Jul : V2-B — Vault+OCR, Family/Lansia, rPPG, Early Warning, Food AI
      H2        : V3 — wearable, Mode Konsultasi, anti-hoaks, What-If
```

*Roadmap ini hidup: tanggal boleh bergeser, urutan dan gerbang keputusannya tidak — kecuali diputuskan sadar di checkpoint. Satu stream, selesai, baru berikutnya. Ramadan adalah jangkarnya; kepercayaan user adalah kompasnya.*
