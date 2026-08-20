<#
  Regresi nutrition-scan (single-model) - Fase 4 gate section 10 / docs/gate-nutrition-launch.md
  ----------------------------------------------------------------------------------
  Menembak SEMUA foto label di -Dir ke Edge Function produksi (memakai model yang
  sedang di-set di secret AI_MODEL_VISION, kini gemini/gemini-3.5-flash-lite),
  lalu merangkum ekstraksi + sanity + latensi ke CSV untuk ditinjau vs label asli.

  Menguji JALUR PRODUKSI PENUH: auth -> vision -> parse -> Zod -> sanity.

  Prasyarat:
    - Access token user (DevTools -> Local Storage -> sb-<ref>-auth-token -> access_token).
      Berlaku ~1 jam; bila kadaluarsa di tengah jalan skrip berhenti + memberi tahu.
    - Anon key = NEXT_PUBLIC_SUPABASE_ANON_KEY (publik).
    - Folder berisi foto label (.jpg/.jpeg/.png/.webp).

  Contoh:
    .\scripts\nutrition-scan-regresi.ps1 -Token $token -Anon $anon -Dir "C:\Users\MASTER\Pictures\labels"

  Bila diblokir ExecutionPolicy:
    powershell -ExecutionPolicy Bypass -File .\scripts\nutrition-scan-regresi.ps1 -Token $token -Anon $anon -Dir "...\labels"

  Menilai AKURASI: skrip tak tahu angka sebenarnya - buka CSV, bandingkan tiap baris
  dengan foto labelnya. Target: mayoritas 'ok', angka sesuai, latensi wajar.

  CATATAN: file ini ASCII-only (PowerShell 5.1 membaca .ps1 tanpa BOM sbg cp1252,
  jadi hindari em-dash/kutip-melengkung/simbol non-ASCII).
#>
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Anon,
  [string]$Dir = ".\labels",
  [string]$Out = ".\regresi-hasil.csv",
  [int]$DelayMs = 300,
  [int]$TimeoutSec = 120
)

$fn = "https://bawdoynqbwnxihnbgxfc.supabase.co/functions/v1/nutrition-scan"

if (-not (Test-Path $Dir)) { Write-Host "Folder tidak ditemukan: $Dir" -ForegroundColor Red; return }
$imgs = Get-ChildItem -Path $Dir -File | Where-Object { $_.Extension -match '\.(jpe?g|png|webp)$' } | Sort-Object Name
if ($imgs.Count -eq 0) { Write-Host "Tak ada gambar (.jpg/.jpeg/.png/.webp) di $Dir" -ForegroundColor Red; return }
Write-Host "Menemukan $($imgs.Count) gambar di $Dir. Mulai regresi..."
Write-Host ""

$rows = @()
$i = 0
foreach ($f in $imgs) {
  $i++
  $mime = if ($f.Extension -match 'png') { 'image/png' } elseif ($f.Extension -match 'webp') { 'image/webp' } else { 'image/jpeg' }
  $dataUrl = "data:$mime;base64," + [Convert]::ToBase64String([IO.File]::ReadAllBytes($f.FullName))
  $reqBody = @{ imageUrl = $dataUrl } | ConvertTo-Json -Compress

  $sw = [Diagnostics.Stopwatch]::StartNew()
  $r = $null
  $status = ""
  try {
    $r = Invoke-RestMethod -Method Post -Uri $fn `
      -Headers @{ Authorization = "Bearer $Token"; apikey = $Anon } `
      -ContentType "application/json" -Body $reqBody -TimeoutSec $TimeoutSec
    $status = "ok"
  } catch {
    $code = 0
    try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -eq 401) {
      Write-Host ""
      Write-Host "401 Unauthorized di file #$i ($($f.Name)) - token kadaluarsa. Refresh token, lalu jalankan lagi." -ForegroundColor Yellow
      break
    }
    $bodyErr = ""
    try { $bodyErr = (New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() } catch {}
    if ($bodyErr -match 'not_a_label') { $status = "not_a_label" }
    elseif ($code -gt 0) { $status = "err_$code" }
    else { $status = "err_local" }
  }
  $secs = [math]::Round($sw.Elapsed.TotalSeconds, 1)

  $e = $r.extracted
  $s = $r.sanity
  $ps = $e.per_serving
  $rows += [pscustomobject]@{
    file         = $f.Name
    status       = $status
    detik        = $secs
    needsConfirm = if ($status -eq 'ok') { [bool]$s.needsConfirmation } else { '' }
    flags        = if ($status -eq 'ok' -and $s.recheck) { ($s.recheck) -join '|' } else { '' }
    serving      = if ($e) { "$($e.serving_size.value)$($e.serving_size.unit)" } else { '' }
    per_pack     = $e.servings_per_pack
    energi_kcal  = $ps.energy_kcal
    gula_g       = $ps.sugar_g
    natrium_mg   = $ps.sodium_mg
    lemak_g      = $ps.fat_g
    jenuh_g      = $ps.sat_fat_g
    bahan        = if ($e -and $e.ingredients_raw) { 'ada' } else { '-' }
  }
  Write-Host ("[{0,3}/{1}] {2,-40} {3,-12} {4}s" -f $i, $imgs.Count, $f.Name, $status, $secs)
  Start-Sleep -Milliseconds $DelayMs
}

$rows | Export-Csv -Path $Out -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "===== RINGKASAN ($($rows.Count) diproses) =====" -ForegroundColor Cyan
$rows | Group-Object status | Sort-Object Count -Descending | ForEach-Object { "  {0,-14} {1}" -f $_.Name, $_.Count }
$ok = @($rows | Where-Object { $_.status -eq 'ok' })
if ($ok.Count -gt 0) {
  $avg = [math]::Round(($ok.detik | Measure-Object -Average).Average, 1)
  $maxs = ($ok.detik | Measure-Object -Maximum).Maximum
  $need = @($ok | Where-Object { $_.needsConfirm -eq $true }).Count
  Write-Host ("  latensi ok: rata2 {0}s, maks {1}s" -f $avg, $maxs)
  Write-Host ("  perlu konfirmasi (sanity/confidence): {0}/{1}" -f $need, $ok.Count)
}
Write-Host ""
Write-Host "CSV: $Out  - buka + bandingkan tiap baris dengan foto labelnya untuk menilai akurasi." -ForegroundColor Green
