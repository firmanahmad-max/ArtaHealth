"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { SheetModal, StreakFlame, EmptyState, useToast } from "@arta/design-system";
import { isScheduledOn, isoWeekdayOf } from "@arta/core";
import { db } from "@/lib/db";
import { createHabit, toggleCompletion, currentStreak, todayKey } from "@/lib/habits";

const ICONS = ["💪", "📖", "🧘", "🚶", "💊", "🥗", "🛏️", "🕌"];
const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]; // ISO 1..7

export function HabitCard() {
  const { show } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICONS[0]!);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

  const today = todayKey();
  const weekday = isoWeekdayOf(today);

  const habits = useLiveQuery(() => db.habits.filter((h) => h.isActive && !h.deletedAt).toArray(), []);
  const completions = useLiveQuery(() => db.habit_completions.toArray(), []);

  const scheduledToday = (habits ?? []).filter((h) => isScheduledOn(h.schedule, weekday));
  const doneToday = new Set(
    (completions ?? []).filter((c) => c.date === today && !c.deletedAt).map((c) => c.habitId),
  );
  const streak = currentStreak(habits ?? [], completions ?? []);

  const toggle = async (habitId: string, habitName: string) => {
    const nowDone = !doneToday.has(habitId);
    await toggleCompletion(habitId, today, nowDone);
    if (nowDone) {
      show({ message: `${habitName} selesai`, onUndo: () => void toggleCompletion(habitId, today, false) });
    }
  };

  const saveHabit = async () => {
    setBusy(true);
    try {
      await createHabit({ name, icon, scheduleDays: days });
      setFormOpen(false);
      setName(""); setIcon(ICONS[0]!); setDays([1, 2, 3, 4, 5, 6, 7]);
      show({ message: "Kebiasaan baru ditambahkan" });
    } catch {
      show({ variant: "error", message: "Gagal menyimpan kebiasaan. Coba lagi." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>Kebiasaan hari ini</h2>
        <StreakFlame streak={streak} />
      </div>

      {scheduledToday.length === 0 ? (
        <EmptyState
          icon="✨"
          title="Belum ada kebiasaan"
          description="Mulai dari satu yang kecil — konsistensi mengalahkan intensitas."
          ctaLabel="+ Tambah Kebiasaan"
          onCta={() => setFormOpen(true)}
        />
      ) : (
        <>
          {scheduledToday.map((h) => {
            const done = doneToday.has(h.id);
            return (
              <label
                key={h.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, minHeight: 44, cursor: "pointer",
                  padding: "4px 6px", borderRadius: "var(--ah-r-chip)",
                }}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => void toggle(h.id, h.name)}
                  style={{ width: 20, height: 20, accentColor: "var(--ah-cyan)" }}
                />
                <span aria-hidden style={{ fontSize: 16 }}>{h.icon ?? "✅"}</span>
                <span
                  style={{
                    fontSize: 13, fontWeight: 600, flex: 1,
                    color: done ? "var(--ah-text-tertiary)" : "var(--ah-text-primary)",
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {h.name}
                </span>
              </label>
            );
          })}
          <button
            onClick={() => setFormOpen(true)}
            style={{ minHeight: 44, border: "1px dashed var(--ah-border)", borderRadius: "var(--ah-r-inner)", background: "transparent", color: "var(--ah-cyan)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            + Tambah Kebiasaan
          </button>
        </>
      )}

      <SheetModal open={formOpen} onClose={() => setFormOpen(false)} title="Kebiasaan Baru">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={label}>
            Nama kebiasaan
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Minum vitamin" maxLength={80} style={input} />
          </label>
          <div>
            <p style={{ ...label, marginBottom: 6 }}>Ikon</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ICONS.map((i) => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  aria-pressed={icon === i}
                  style={{
                    width: 44, height: 44, fontSize: 20, cursor: "pointer",
                    borderRadius: "var(--ah-r-chip)", background: "var(--ah-surface-2)",
                    border: icon === i ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                  }}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ ...label, marginBottom: 6 }}>Hari</p>
            <div style={{ display: "flex", gap: 4 }}>
              {DAY_LABELS.map((d, idx) => {
                const iso = idx + 1;
                const active = days.includes(iso);
                return (
                  <button
                    key={d}
                    onClick={() => setDays((v) => (active ? v.filter((x) => x !== iso) : [...v, iso]))}
                    aria-pressed={active}
                    style={{
                      flex: 1, minHeight: 44, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      borderRadius: "var(--ah-r-chip)",
                      border: active ? "1.5px solid var(--ah-cyan)" : "1px solid var(--ah-border)",
                      background: active ? "var(--ah-gradient-soft)" : "var(--ah-surface-2)",
                      color: active ? "var(--ah-text-primary)" : "var(--ah-text-tertiary)",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => void saveHabit()}
            disabled={busy || name.trim().length === 0 || days.length === 0}
            style={{
              minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "none",
              background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              opacity: !busy && name.trim() && days.length > 0 ? 1 : 0.5,
            }}
          >
            Simpan Kebiasaan
          </button>
        </div>
      </SheetModal>
    </div>
  );
}

const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ah-text-secondary)" };
const input: React.CSSProperties = {
  minHeight: 48, borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
  background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 14px", fontSize: 15,
};
