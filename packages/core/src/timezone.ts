/**
 * Helper zona waktu berbasis Intl (tanpa dependensi) — dipakai Edge Function
 * daily-score untuk menentukan "hari lokal" tiap profil (profiles.timezone, IANA).
 */

/** "2026-07-18" — tanggal kalender di timeZone pada instan `now`. */
export function localDateKey(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Jam lokal 0–23 di timeZone pada instan `now`. */
export function localHour(now: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now);
  return Number(h);
}

/** Rentang UTC [startUtc, endUtc) yang memuat seluruh tanggal lokal `dateKey` di timeZone. */
export function utcRangeForLocalDate(dateKey: string, timeZone: string): { startUtc: Date; endUtc: Date } {
  // offset diambil pada tengah hari lokal — aman dari transisi DST di batas hari
  const offsetMin = tzOffsetMinutes(new Date(`${dateKey}T12:00:00Z`), timeZone);
  const startUtc = new Date(new Date(`${dateKey}T00:00:00Z`).getTime() - offsetMin * 60_000);
  return { startUtc, endUtc: new Date(startUtc.getTime() + 24 * 3_600_000) };
}

/** Offset menit timeZone terhadap UTC pada `instant` (WIB = +420). */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}
