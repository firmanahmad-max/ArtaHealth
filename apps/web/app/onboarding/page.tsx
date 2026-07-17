"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onboardingProfileSchema, GOAL_LABELS, PRIMARY_GOALS, CONSENT_COPY, CONSENT_KEYS,
  type PrimaryGoal, type ConsentKey,
} from "@arta/core";
import { useToast } from "@arta/design-system";
import { getSupabase, getPrimaryProfile } from "@/lib/supabase";

type Step = "basics" | "consent";

/** Onboarding langkah 4–5: data dasar + izin (ui-ux-spec §3.8). Target < 90 detik total. */
export default function OnboardingPage() {
  const router = useRouter();
  const { show } = useToast();
  const supabase = getSupabase();

  const [step, setStep] = useState<Step>("basics");
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [goal, setGoal] = useState<PrimaryGoal | null>(null);
  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    health_data_processing: false, ai_analysis: false, notifications: false,
  });

  useEffect(() => {
    if (!supabase) { router.replace("/login"); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
    });
  }, [supabase, router]);

  if (!supabase) return null;

  const basicsValid =
    goal !== null &&
    onboardingProfileSchema.safeParse({
      displayName,
      dateOfBirth: dateOfBirth || undefined,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      primaryGoal: goal,
    }).success;

  const finish = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const accountId = auth.user?.id;
      if (!accountId) { router.replace("/login"); return; }

      const existing = await getPrimaryProfile();
      const profileRow = {
        account_id: accountId,
        display_name: displayName.trim(),
        date_of_birth: dateOfBirth || null,
        height_cm: heightCm ? Number(heightCm) : null,
        primary_goal: goal,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
        is_primary: true,
        onboarded_at: new Date().toISOString(),
      };
      const { data: profile, error: profileErr } = existing
        ? await supabase.from("profiles").update(profileRow).eq("id", existing.id).select("id").single()
        : await supabase.from("profiles").insert(profileRow).select("id").single();
      if (profileErr || !profile) throw profileErr ?? new Error("profil kosong");

      if (weightKg) {
        // idempotent via unique (profile_id, client_id)
        await supabase.from("weight_logs").upsert(
          { profile_id: profile.id, weight_kg: Number(weightKg), client_id: `onboarding-${profile.id}` },
          { onConflict: "profile_id,client_id" },
        );
      }

      const granted = CONSENT_KEYS.filter((k) => consents[k]);
      if (granted.length > 0) {
        const { error: consentErr } = await supabase.from("consents").upsert(
          granted.map((k) => ({ account_id: accountId, consent_key: k, revoked_at: null })),
          { onConflict: "account_id,consent_key" },
        );
        if (consentErr) throw consentErr;
      }

      if (consents.notifications && typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }

      router.replace("/");
    } catch {
      show({ variant: "error", message: "Gagal menyimpan. Periksa koneksi lalu coba lagi." });
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "40px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
        Langkah {step === "basics" ? "1" : "2"} dari 2
      </p>

      {step === "basics" ? (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Kenalan dulu, yuk</h1>
          <label style={label}>
            Nama panggilan
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="mis. Firman" maxLength={50} style={input} />
          </label>
          <label style={label}>
            Tanggal lahir <span style={optional}>(opsional)</span>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} max={new Date().toISOString().slice(0, 10)} style={input} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={label}>
              Tinggi (cm) <span style={optional}>(opsional)</span>
              <input type="number" inputMode="decimal" min={50} max={250} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="168" style={input} />
            </label>
            <label style={label}>
              Berat (kg) <span style={optional}>(opsional)</span>
              <input type="number" inputMode="decimal" min={20} max={400} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="62" style={input} />
            </label>
          </div>

          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ah-text-secondary)", marginTop: 4 }}>Apa target utama Anda?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {PRIMARY_GOALS.map((g) => {
              const active = goal === g;
              return (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  aria-pressed={active}
                  style={{
                    minHeight: 72, borderRadius: "var(--ah-r-inner)", cursor: "pointer",
                    border: active ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                    background: active ? "var(--ah-gradient-soft)" : "var(--ah-surface-1)",
                    color: "var(--ah-text-primary)", display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 4, fontSize: 13, fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{GOAL_LABELS[g].icon}</span>
                  {GOAL_LABELS[g].title}
                </button>
              );
            })}
          </div>

          <button onClick={() => setStep("consent")} disabled={!basicsValid} style={{ ...btnPrimary, opacity: basicsValid ? 1 : 0.5 }}>
            Lanjut
          </button>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Terakhir — izin Anda</h1>
          <p style={{ fontSize: 13, color: "var(--ah-text-secondary)" }}>
            Kami minta persetujuan per poin, bukan borongan. Anda bisa mengubahnya kapan saja di Profil.
          </p>
          {CONSENT_KEYS.map((k) => (
            <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--ah-text-primary)", background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-inner)", padding: "12px 14px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={consents[k]}
                onChange={(e) => setConsents((c) => ({ ...c, [k]: e.target.checked }))}
                style={{ width: 18, height: 18, marginTop: 1, accentColor: "var(--ah-cyan)" }}
              />
              <span>
                {CONSENT_COPY[k].label}{" "}
                {CONSENT_COPY[k].required && <strong style={{ color: "var(--ah-score-fair)" }}>(wajib)</strong>}
              </span>
            </label>
          ))}
          <button
            onClick={finish}
            disabled={busy || !consents.health_data_processing}
            style={{ ...btnPrimary, opacity: !busy && consents.health_data_processing ? 1 : 0.5 }}
          >
            {busy ? "Menyimpan…" : "Selesai & Mulai"}
          </button>
          <button onClick={() => setStep("basics")} disabled={busy} style={btnGhost}>
            Kembali
          </button>
        </>
      )}
    </main>
  );
}

const btnPrimary: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "none",
  background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6,
};
const btnGhost: React.CSSProperties = {
  minHeight: 44, border: "none", background: "transparent", color: "var(--ah-text-tertiary)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ah-text-secondary)" };
const optional: React.CSSProperties = { fontWeight: 400, color: "var(--ah-text-tertiary)" };
const input: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 14px", fontSize: 15,
};
