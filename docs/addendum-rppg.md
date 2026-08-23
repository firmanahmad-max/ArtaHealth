# Addendum — Cek Nadi via Kamera (rPPG) · Fase 6 #3

Status: **RP-1 (riset spike)** · Metode: **ujung jari + flash** (kontak) · Flag: `NEXT_PUBLIC_FEATURE_RPPG` (OFF)

> ⚠️ **Gerbang wajib sebelum flag nyala** (lihat §7). Fitur ini menyentuh ranah medis
> → framing non-diagnosis ketat + validasi akurasi + review medis. Sampai gerbang lewat,
> fitur ini **spike/PoC** untuk dievaluasi, bukan produk yang dirilis.

## 1. Tujuan & batas

Memberi pengguna **estimasi denyut nadi (BPM)** dari kamera ponsel, sebagai sinyal
kesadaran-diri — **bukan alat medis, bukan diagnosis, bukan pulse oximeter**. Tidak
mengukur SpO₂. Tidak untuk keputusan klinis, darurat, atau pemantauan aritmia.

## 2. Kenapa ujung jari + flash (bukan wajah)

Kekhawatiran roadmap = **akurasi di device kelas menengah**. Pilihan kontak (jari
menutup kamera belakang + flash menyala) memberi:

- **Sinyal PPG jauh lebih kuat & stabil** — cahaya flash menembus jaringan jari, variasi
  warna per-denyut besar → SNR tinggi (prinsip sama dengan pulse oximeter transmisi/refleksi).
- **Tahan cahaya sekitar & skin-tone** — sumber cahaya terkontrol (flash), bukan cahaya ruang.
- **Pemrosesan ringan** — cukup rata-rata 1 kanal warna per frame; tanpa face-tracking.

Metode wajah (kontakless) lebih "wow" tapi rapuh (gerakan, cahaya, skin-tone, device murah)
→ ditunda ke iterasi berikut; arsitektur engine dibuat agnostik sumber sinyal.

## 3. Pipeline sinyal (deterministik — `packages/core/rppg.ts`)

Input: deret sampel `{ t: ms, value: 0..255 }` = **rata-rata kanal merah** per frame
(merah paling responsif terhadap volume darah saat diterangi flash).

1. **Estimasi fs** dari timestamp: `fs = (n−1) / ((t_last − t_first)/1000)` Hz.
2. **Bandpass** (murah, tanpa lib): highpass = `x − movingAvg(x, longWin)` (buang baseline
   wander/napas), lalu lowpass = `movingAvg(·, shortWin)` (buang derau frame).
   - `longWin ≈ fs·60/minBpm`, `shortWin ≈ fs·60/maxBpm`.
3. **Autokorelasi** pada rentang lag periode denyut `[fs·60/maxBpm, fs·60/minBpm]`; cari
   puncak ternormalisasi. **Interpolasi parabolik** di sekitar puncak → BPM sub-sampel.
   - `bpm = 60·fs / lagPuncak`.
4. **Confidence** = nilai autokorelasi ternormalisasi di puncak (0..1) → proxy periodisitas.

Rentang default: **40–200 BPM** (0.667–3.33 Hz).

### Gerbang kualitas (engine menolak menebak saat data buruk)
- `durationSec < minDuration` (≈8 dtk) → `insufficient`.
- `fs < minFs` (≈10 Hz) → `insufficient` (frame rate terlalu rendah).
- `confidence < ambang` → `low_quality` (jari bergerak / tak menutup kamera / cahaya kurang).
- Hanya `status === "ok"` yang menampilkan angka BPM.

## 4. Tangkap kamera (PoC — `apps/web/lib/rppg-capture.ts` + `PulseCheckCard`)

- `getUserMedia({ video: { facingMode: "environment" } })` → nyalakan **torch** via
  `track.applyConstraints({ advanced: [{ torch: true }] })` (tak semua device dukung → fallback).
- Tiap frame: gambar ke `<canvas>` kecil (mis. 64×64 tengah), hitung rata-rata R → sampel.
- Kumpulkan ~15–20 dtk sambil tampilkan progres + mutu sinyal real-time.
- **Semua pemrosesan on-device.** Video/foto **tidak** diunggah, tidak disimpan. Hanya
  angka BPM akhir yang (opsional, iterasi lanjut) bisa dicatat.
- Matikan torch + stop track saat selesai/batal (hindari kamera menyala menggantung).

## 5. Privasi

Kamera aktif hanya selama pengukuran; frame diproses di memori lalu dibuang. Tidak ada
video/gambar yang meninggalkan device. Minta izin kamera per-sesi; jelaskan alasannya.

## 6. Keamanan & teks (non-diagnosis)

- Judul jelas "perkiraan", disclaimer permanen: *"Bukan alat medis. Estimasi kasar untuk
  kesadaran diri — jangan dipakai untuk keputusan medis atau keadaan darurat."*
- **Red-flag statis** (bukan diagnosis): bila hasil di luar 40–120 saat istirahat, saran
  netral "bila terasa berdebar/pusing, hubungi tenaga kesehatan". Tidak menyebut penyakit.
- Tidak mengklaim deteksi aritmia/atrial fibrilasi.

## 7. Gerbang sebelum flag nyala (RP-2+)

1. **Validasi akurasi**: bandingkan vs oximeter/alat referensi, ≥N subjek lintas skin-tone
   & beberapa device kelas menengah. Target awal: **MAE ≤ ±5 BPM** pada kondisi baik.
2. **Uji device nyata**: torch tersedia? frame rate cukup (≥15 fps)? di Android mid-range.
3. **Review medis + hukum**: teks disclaimer & red-flag ditinjau; pastikan tak masuk kategori
   alat kesehatan yang butuh izin edar.
4. Jika lolos → RP-2 (poles UX, persistensi hasil opsional + sync), lalu nyalakan flag.

Jika akurasi/torch tak memadai di device target → **fitur ditahan** (spike gagal itu hasil
yang sah); pertimbangkan hanya-dukung device yang lulus, atau tunda.

## 8. Status increment

- **RP-1**: addendum (dok ini) + engine deterministik `rppg.ts` (teruji sintetis) + PoC
  tangkap kamera di balik flag. Engine = "spike" matematis; PoC = alat uji Firman di HP nyata.
- Berikutnya: kumpulkan data validasi (§7) → putuskan lanjut/tahan.
