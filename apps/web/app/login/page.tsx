"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@arta/design-system";
import { getSupabase, getPrimaryProfile } from "@/lib/supabase";

type Step = "method" | "otp";

/** Onboarding langkah 3 — Auth: Google 1-tap / email OTP (ui-ux-spec §3.8). */
export default function LoginPage() {
  const router = useRouter();
  const { show } = useToast();
  const [step, setStep] = useState<Step>("method");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = getSupabase();

  if (!supabase) {
    return (
      <Shell>
        <p style={{ fontSize: 13, color: "var(--ah-text-secondary)", textAlign: "center" }}>
          Supabase belum dikonfigurasi. Salin <code>.env.example</code> ke{" "}
          <code>apps/web/.env.local</code> lalu isi URL & anon key.
        </p>
      </Shell>
    );
  }

  const loginGoogle = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      show({ variant: "error", message: "Masuk dengan Google gagal. Coba lagi sebentar." });
      setBusy(false);
    }
  };

  const sendOtp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      show({ variant: "error", message: "Kode gagal terkirim. Periksa alamat email Anda." });
      return;
    }
    show({ variant: "info", message: `Kode 6 digit terkirim ke ${email.trim()}` });
    setStep("otp");
  };

  const verifyOtp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      show({ variant: "error", message: "Kode tidak cocok atau kedaluwarsa. Coba kirim ulang." });
      return;
    }
    const profile = await getPrimaryProfile();
    router.replace(profile?.onboarded_at ? "/" : "/onboarding");
  };

  return (
    <Shell>
      {step === "method" ? (
        <>
          <button onClick={loginGoogle} disabled={busy} style={btnPrimary}>
            Masuk dengan Google
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ah-text-tertiary)", fontSize: 12 }}>
            <span style={hr} /> atau <span style={hr} />
          </div>
          <label style={label}>
            Email
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              style={input}
            />
          </label>
          <button onClick={sendOtp} disabled={busy || !email.includes("@")} style={btnSecondary}>
            {busy ? "Mengirim…" : "Kirim Kode Masuk"}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--ah-text-secondary)", textAlign: "center" }}>
            Masukkan kode 6 digit yang kami kirim ke <strong>{email.trim()}</strong>
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            style={{ ...input, textAlign: "center", letterSpacing: "0.4em", fontSize: 20, fontVariantNumeric: "tabular-nums" }}
          />
          <button onClick={verifyOtp} disabled={busy || token.length !== 6} style={btnPrimary}>
            {busy ? "Memeriksa…" : "Verifikasi"}
          </button>
          <button onClick={() => setStep("method")} style={btnGhost}>
            Ganti email / kirim ulang
          </button>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "56px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 34 }}>🩵</div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>ArtaHealth</h1>
        <p style={{ fontSize: 13, color: "var(--ah-text-secondary)" }}>
          Teman kesehatan harian Anda — masuk untuk mulai.
        </p>
      </div>
      {children}
    </main>
  );
}

const btnBase: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const btnPrimary: React.CSSProperties = { ...btnBase, border: "none", background: "var(--ah-gradient-hero)", color: "#fff" };
const btnSecondary: React.CSSProperties = { ...btnBase, border: "1px solid var(--ah-border)", background: "var(--ah-surface-1)", color: "var(--ah-text-primary)" };
const btnGhost: React.CSSProperties = { ...btnBase, border: "none", background: "transparent", color: "var(--ah-cyan)", minHeight: 44 };
const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ah-text-secondary)" };
const input: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 14px", fontSize: 15,
};
const hr: React.CSSProperties = { flex: 1, height: 1, background: "var(--ah-border)" };
