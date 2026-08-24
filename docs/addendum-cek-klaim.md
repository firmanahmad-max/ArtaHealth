# Addendum — Cek Klaim Kesehatan (anti-hoaks) · V3-4

Status: **DRAFT desain + gerbang** (belum dibangun) · Disusun 24 Agu 2026 · Flag: `NEXT_PUBLIC_FEATURE_CEK_KLAIM` (OFF)

> ⚠️ **Fitur PALING berisiko di V3** — AI menilai klaim kesehatan viral = domain misinformasi
> medis sensitif. **Tak dibangun/dirilis sebelum gerbang konten §6 lewat.** Dokumen ini
> menetapkan batas, arsitektur berpagar, dan gerbang — bukan izin untuk langsung koding.

## 1. Tujuan & batas (paling penting)

Membantu pengguna menyikapi **klaim kesehatan viral** (mis. "rebusan X menyembuhkan diabetes")
dengan: konteks, apa kata **sumber resmi**, dan dorongan verifikasi — **sinergi ArtaBot**.

**BUKAN**:
- Bukan vonis "BENAR/SALAH" mutlak. Output = tingkat dukungan bukti + ajakan verifikasi.
- Bukan nasihat medis personal, bukan diagnosis, bukan resep. Tak pernah menyuruh mulai/berhenti
  obat/terapi (CONTEXT §4).
- Bukan sumber kebenaran tunggal — selalu mengarahkan ke tenaga kesehatan & sumber resmi untuk
  keputusan pribadi.

## 2. Kenapa tak bisa "deterministik menilai kebenaran"

Kebenaran klaim medis tak bisa dihitung rule-engine → lapisan penilaian **wajib AI**. Maka risiko
dikungkung dengan: (a) **gerbang keamanan deterministik** di depan, (b) **retrieval sumber terkurasi**,
(c) **output berpagar + tervalidasi Zod**, (d) framing hati-hati permanen. AI menilai; app membingkai.

## 3. Arsitektur berpagar (deterministik dulu, AI dikungkung)

1. **CK-1 — Gerbang keamanan DETERMINISTIK** (`packages/core/claim-safety.ts`, teruji):
   - Klasifikasi topik & red-flag via kata kunci: kategori berbahaya (klaim penyembuhan penyakit
     serius: kanker/diabetes/HIV; anjuran stop obat; dosis; terapi alternatif berisiko; anti-vaksin;
     produk "ajaib") → **JANGAN minta AI menilai benar/salah**; kembalikan template tegas: "klaim
     ini butuh kehati-hatian tinggi — rujuk sumber resmi & tenaga kesehatan" + tautan resmi.
   - Klaim di luar domain kesehatan → tolak sopan (bukan cakupan).
   - Hanya klaim yang lolos gerbang → diteruskan ke CK-2.
2. **CK-2 — Penilaian AI berpagar** (Edge Function `claim-check`, di balik gerbang):
   - Retrieval **sumber terkurasi** (daftar putih: Kemenkes, WHO, BPOM, IDAI, PERKENI/PERHI, jurnal
     tepercaya) — MVP: korpus ringkas terkurasi in-repo / API resmi; **tanpa** scraping web bebas.
   - LLM menghasilkan **JSON tervalidasi Zod**: `{ stance: "didukung"|"belum-cukup-bukti"|
     "bertentangan-dengan-anjuran-resmi"|"perlu-verifikasi", ringkasan, sumber[], catatan_keamanan }`.
     Gagal validasi → retry 1× → fallback template "belum bisa memeriksa; rujuk sumber resmi".
   - **Larangan keras** di prompt: tak menyebut dosis/mulai-stop obat, tak mendiagnosis, tak
     menjanjikan kesembuhan; sertakan disclaimer + minimal 1 sumber resmi.
3. **UI**: kartu hasil = stance (bahasa netral, bukan cap "HOAKS" sepihak) + ringkasan + **sumber
   resmi (tautan)** + disclaimer permanen + tombol "Tanya ArtaBot / cari nakes".

## 4. Privasi & keamanan

- Klaim yang dikirim = teks user; jangan simpan PII; jangan kaitkan ke profil di log/analytics (§5.3).
- Log hanya untuk kualitas (klaim → stance) tanpa identitas, opsional & anonim.
- Rate-limit (anti-abuse) + kuota (sinergi kuota AI Chat).

## 5. Increment

- **CK-1**: engine `claim-safety.ts` (klasifikasi topik + red-flag + template escalation) + test penuh.
  Deterministik, aman, bisa berdiri sendiri (tanpa AI) → sudah memberi nilai (menahan klaim berbahaya).
- **CK-2**: Edge Function `claim-check` (retrieval terkurasi + LLM + Zod + fallback) + UI + flag.
- **CK-3**: sinergi ArtaBot (deteksi "ini benar/hoaks?" di chat → arahkan ke Cek Klaim).

## 6. GERBANG KONTEN (wajib sebelum flag nyala)

1. **Kurasi sumber**: daftar putih sumber resmi final + mekanisme rujukan (bukan web bebas).
2. **Review medis**: dokter meninjau prompt, contoh output lintas klaim umum ID (jamu, diet ekstrem,
   anti-vaksin, "obat herbal sembuhkan X"), & teks kategori/stance.
3. **Uji adversarial**: klaim menyesatkan/menjebak → sistem tak pernah memberi vonis berbahaya atau
   nasihat medis; selalu eskalasi aman. Sertakan set uji regresi.
4. **Kebijakan topik terlarang** terdokumentasi (kapan menolak menilai & langsung eskalasi).
5. **Hukum/kebijakan**: pastikan framing tak menempatkan app sebagai otoritas medis; disclaimer memadai.

Jika gerbang tak terpenuhi → **fitur ditahan** (parkir di backlog). Lebih baik tak ada daripada
salah menilai klaim kesehatan.

## 7. Status

- Dokumen desain + gerbang ini = langkah pertama (sesuai roadmap "perlu gerbang konten").
- **Belum ada kode.** Berikutnya (bila disetujui): CK-1 engine keamanan deterministik + test —
  bagian yang aman & jarang-salah — sambil menyiapkan kurasi sumber & review medis untuk CK-2.

Referensi: `docs/master-roadmap.md` (Fase 7), `docs/roadmap-v3.md` (§4 urutan, V3-4), CONTEXT §4 (keselamatan).
