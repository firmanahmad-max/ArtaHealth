"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, getPrimaryProfile } from "@/lib/supabase";

/**
 * Tujuan redirect OAuth (PKCE). supabase-js menukar ?code menjadi sesi secara
 * otomatis (detectSessionInUrl) — halaman ini hanya menunggu lalu mengarahkan.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { router.replace("/login"); return; }

    let done = false;
    const go = async () => {
      if (done) return;
      done = true;
      const profile = await getPrimaryProfile();
      router.replace(profile?.onboarded_at ? "/" : "/onboarding");
    };

    supabase.auth.getSession().then(({ data }) => { if (data.session) void go(); });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void go();
    });
    const timeout = setTimeout(() => { if (!done) setFailed(true); }, 8000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, [router]);

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "80px 20px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 }}>
      {failed ? (
        <>
          <p style={{ fontSize: 14, color: "var(--ah-text-primary)" }}>Sesi tidak ditemukan.</p>
          <button
            onClick={() => router.replace("/login")}
            style={{ minHeight: 44, border: "none", background: "transparent", color: "var(--ah-cyan)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            Kembali ke halaman masuk
          </button>
        </>
      ) : (
        <p style={{ fontSize: 14, color: "var(--ah-text-secondary)" }}>Menyiapkan sesi Anda…</p>
      )}
    </main>
  );
}
