// ArtaHealth · Edge Function `send-reminders`
// Mengirim pengingat push yang SELALU personal (ui-ux-spec §6 poin 5).
// Isi pesan ditentukan mesin deterministik packages/core/src/notifications.ts —
// bila tidak ada yang personal untuk disampaikan, tidak ada yang dikirim.
//
// Dipicu pg_cron tiap jam (migration 0009). Untuk tiap profil: hitung konteks
// hari lokalnya, tanya buildReminder, lalu kirim ke semua perangkat aktif.
// Dedup dijaga tabel reminder_log (PK profile_id+date+kind).
//
// Deploy: supabase functions deploy send-reminders
// Butuh env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { aggregateDayInputs } from "../../../packages/core/src/aggregate.ts";
import { computeHealthScore } from "../../../packages/core/src/scoring/health-score.ts";
import { buildReminder, type ReminderKind } from "../../../packages/core/src/notifications.ts";
import { isScheduledOn, isoWeekdayOf } from "../../../packages/core/src/habits.ts";
import { computePrayerTimes } from "../../../packages/core/src/fasting/prayer-times.ts";
import { buildSahurReminder } from "../../../packages/core/src/fasting/reminders.ts";
import {
  localDateKey, localHour, localMinuteOfDay, tzOffsetMinutes, utcRangeForLocalDate,
} from "../../../packages/core/src/timezone.ts";
import type { InsightContext } from "../../../packages/core/src/ai/contracts.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:halo@artahealth.id";
  if (!vapidPublic || !vapidPrivate) return json({ error: "VAPID belum dikonfigurasi" }, 500);
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (e) {
    // kunci/subject tidak valid → pesan jelas, bukan 500 opaque
    return json({ error: `VAPID setup gagal: ${(e as Error).message}` }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const now = new Date();

  // hanya profil yang punya perangkat aktif — sisanya tidak perlu dihitung
  const { data: devices, error: devicesErr } = await supabase
    .from("push_devices")
    .select("id, profile_id, endpoint, p256dh, auth")
    .is("revoked_at", null);
  if (devicesErr) return json({ error: devicesErr.message }, 500);
  if (!devices || devices.length === 0) return json({ sent: 0, skipped: 0 });

  // Mode uji: kirim notifikasi statis ke semua perangkat aktif, lewati mesin
  // pengingat & jam istirahat. Untuk memverifikasi setup push kapan pun.
  if (new URL(req.url).searchParams.get("test") === "1") {
    const payload = JSON.stringify({
      title: "ArtaHealth", body: "Notifikasi uji — pengingat Anda aktif ✓", url: "/", kind: "test",
    });
    let sent = 0;
    for (const device of devices) {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_devices").update({ revoked_at: new Date().toISOString() }).eq("id", device.id);
        }
      }
    }
    return json({ test: true, sent, devices: devices.length });
  }

  const byProfile = new Map<string, typeof devices>();
  for (const d of devices) {
    if (!byProfile.has(d.profile_id)) byProfile.set(d.profile_id, []);
    byProfile.get(d.profile_id)!.push(d);
  }

  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, timezone, target_hydration_ml, target_steps")
    .in("id", [...byProfile.keys()])
    .is("deleted_at", null);
  if (profilesErr) return json({ error: profilesErr.message }, 500);

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const profile of profiles ?? []) {
    try {
      const tz = profile.timezone || "Asia/Jakarta";
      const hour = localHour(now, tz);
      const dateKey = localDateKey(now, tz);
      const { startUtc, endUtc } = utcRangeForLocalDate(dateKey, tz);
      const startIso = startUtc.toISOString();
      const endIso = endUtc.toISOString();

      const rows = <T,>(res: { data: unknown }): T[] => (res.data ?? []) as T[];
      const inRange = (table: string, col: string, cols: string) =>
        supabase.from(table).select(cols).eq("profile_id", profile.id)
          .is("deleted_at", null).gte(col, startIso).lt(col, endIso);

      const [hydration, sleep, activity, habits, completions, alreadySent] = await Promise.all([
        inRange("hydration_logs", "logged_at", "volume_ml"),
        inRange("sleep_logs", "sleep_end", "sleep_start, sleep_end"),
        inRange("activity_logs", "logged_at", "duration_min, steps"),
        supabase.from("habits").select("id, schedule").eq("profile_id", profile.id)
          .eq("is_active", true).is("deleted_at", null),
        supabase.from("habit_completions").select("habit_id").eq("profile_id", profile.id)
          .eq("date", dateKey).is("deleted_at", null),
        supabase.from("reminder_log").select("kind").eq("profile_id", profile.id).eq("date", dateKey),
      ]);

      const weekday = isoWeekdayOf(dateKey);
      const scheduled = rows<{ id: string; schedule: { days?: unknown } | null }>(habits)
        .filter((h) => isScheduledOn(h.schedule, weekday));
      const done = new Set(rows<{ habit_id: string }>(completions).map((c) => c.habit_id));

      const inputs = aggregateDayInputs(
        {
          hydration: rows<{ volume_ml: number }>(hydration).map((r) => ({ volumeMl: r.volume_ml })),
          sleep: rows<{ sleep_start: string; sleep_end: string }>(sleep)
            .map((r) => ({ sleepStart: r.sleep_start, sleepEnd: r.sleep_end })),
          activity: rows<{ duration_min: number | null; steps: number | null }>(activity)
            .map((r) => ({ durationMin: r.duration_min, steps: r.steps })),
          habits: scheduled.length > 0
            ? { completed: scheduled.filter((h) => done.has(h.id)).length, total: scheduled.length }
            : undefined,
        },
        { hydrationMl: profile.target_hydration_ml ?? 2500, steps: profile.target_steps ?? 8000 },
      );

      const context: InsightContext = {
        date: dateKey,
        score: { today: computeHealthScore(inputs).score, deltaReason: [] },
        ...(inputs.sleep ? { sleep: { durationMin: inputs.sleep.durationMin } } : {}),
        ...(inputs.hydration
          ? {
              hydration: {
                totalMl: inputs.hydration.intakeMl,
                targetMl: inputs.hydration.targetMl,
                pct: Math.round((inputs.hydration.intakeMl / inputs.hydration.targetMl) * 100),
              },
            }
          : {}),
        ...(inputs.activity
          ? {
              activity: {
                ...(inputs.activity.steps !== undefined ? { steps: inputs.activity.steps } : {}),
                target: inputs.activity.stepTarget,
              },
            }
          : {}),
        ...(inputs.habits ? { habits: inputs.habits } : {}),
      };

      // ── Pengingat sahur (Mode Ramadan) ──────────────────────────────────
      // Terisolasi & defensif: kegagalan/ketiadaan data puasa TIDAK boleh
      // mengganggu pengingat reguler. Inert bila tak ada baris fasting hari ini
      // atau koordinat belum di-set (flag Ramadan mati → tak ada data → no-op).
      // Berjalan SEBELUM buildReminder karena jam pra-fajar biasanya menghasilkan
      // reminder reguler null (jam tenang), tapi sahur justru saat itu.
      try {
        const [fs, fd] = await Promise.all([
          supabase.from("fasting_settings")
            .select("latitude, longitude, sahur_reminder_min, time_correction")
            .eq("profile_id", profile.id).maybeSingle(),
          supabase.from("fasting_days").select("status")
            .eq("profile_id", profile.id).eq("date", dateKey).maybeSingle(),
        ]);
        const fsettings = fs.data as {
          latitude: number | null; longitude: number | null;
          sahur_reminder_min: number | null; time_correction: Record<string, number> | null;
        } | null;
        const isFasting = (fd.data as { status?: string } | null)?.status === "fasting";

        if (isFasting && fsettings && fsettings.latitude != null && fsettings.longitude != null) {
          const [y, mo, d] = dateKey.split("-").map(Number);
          const times = computePrayerTimes({
            year: y, month: mo, day: d,
            coords: { latitude: fsettings.latitude, longitude: fsettings.longitude },
            timezoneOffset: tzOffsetMinutes(now, tz) / 60,
            params: { corrections: fsettings.time_correction ?? {} },
          });
          const sahur = buildSahurReminder({
            nowMinutes: localMinuteOfDay(now, tz),
            imsakMinutes: times.imsak,
            reminderOffsetMin: fsettings.sahur_reminder_min ?? 60,
            hydration: context.hydration
              ? { totalMl: context.hydration.totalMl, targetMl: context.hydration.targetMl }
              : undefined,
          });
          if (sahur) {
            // klaim slot dedup 'sahur' lebih dulu (sekali per hari per profil)
            const { error: sahurClaim } = await supabase.from("reminder_log")
              .insert({ profile_id: profile.id, date: dateKey, kind: "sahur" });
            if (!sahurClaim) {
              const sahurPayload = JSON.stringify({
                title: sahur.title, body: sahur.body, url: sahur.url, kind: "sahur",
              });
              for (const device of byProfile.get(profile.id) ?? []) {
                try {
                  await webpush.sendNotification(
                    { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
                    sahurPayload,
                  );
                  sent++;
                  await supabase.from("push_devices")
                    .update({ last_used_at: new Date().toISOString() }).eq("id", device.id);
                } catch (e) {
                  const status = (e as { statusCode?: number }).statusCode;
                  if (status === 404 || status === 410) {
                    await supabase.from("push_devices")
                      .update({ revoked_at: new Date().toISOString() }).eq("id", device.id);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`sahur gagal profil ${profile.id}: ${(e as Error).message}`);
      }

      const reminder = buildReminder(context, {
        hour,
        alreadySentToday: rows<{ kind: ReminderKind }>(alreadySent).map((r) => r.kind),
      });
      if (!reminder) { skipped++; continue; }

      // klaim slot dedup LEBIH DULU: kalau baris sudah ada, profil ini dilewati
      const { error: claimErr } = await supabase
        .from("reminder_log")
        .insert({ profile_id: profile.id, date: dateKey, kind: reminder.kind });
      if (claimErr) { skipped++; continue; }

      const payload = JSON.stringify({
        title: reminder.title, body: reminder.body, url: reminder.url, kind: reminder.kind,
      });

      for (const device of byProfile.get(profile.id) ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
            payload,
          );
          sent++;
          await supabase.from("push_devices")
            .update({ last_used_at: new Date().toISOString() }).eq("id", device.id);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410 = langganan mati permanen → jangan kirim lagi
          if (status === 404 || status === 410) {
            await supabase.from("push_devices")
              .update({ revoked_at: new Date().toISOString() }).eq("id", device.id);
          }
        }
      }
    } catch (e) {
      // hanya id profil di log — tidak pernah isi notifikasi/data kesehatan (§5.3)
      failures.push(profile.id);
      console.error(`send-reminders gagal untuk profil ${profile.id}: ${(e as Error).message}`);
    }
  }

  return json({ sent, skipped, failed: failures.length });
});
