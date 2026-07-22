"use client";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@arta/design-system";
import { AI_DISCLAIMER, FREE_CHAT_QUOTA_PER_DAY } from "@arta/core";
import { sendChat, type ChatResult } from "@/lib/ai";
import { QuickLogSheet } from "@/components/QuickLogSheet";
import { AppNav } from "@/components/AppNav";

interface Bubble {
  id: string;
  role: "user" | "assistant";
  text: string;
  redFlag?: boolean;
}

const SUGGESTIONS = [
  "Kenapa tidur saya kurang nyenyak?",
  "Berapa target minum saya hari ini?",
  "Olahraga ringan untuk pemula",
];

export default function ChatPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(0);
  const sessionId = useRef<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { sessionId.current = crypto.randomUUID(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: trimmed }]);
    setBusy(true);
    let result: ChatResult;
    try {
      result = await sendChat(trimmed, sessionId.current);
    } finally {
      setBusy(false);
    }
    // red flag & pesan sistem tidak memotong kuota AI
    if (result.source === "ai") setUsed((u) => u + 1);
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "assistant", text: result.reply, redFlag: result.redFlag },
    ]);
  };

  return (
    <>
      <main style={{ maxWidth: 400, margin: "0 auto", padding: "16px 16px 168px", display: "flex", flexDirection: "column", gap: 10 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>Tanya Arta</h1>
            <p style={{ fontSize: 12, color: "var(--ah-text-tertiary)" }}>Seputar kebiasaan sehat harian</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ah-text-tertiary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {Math.max(0, FREE_CHAT_QUOTA_PER_DAY - used)}/{FREE_CHAT_QUOTA_PER_DAY} pesan
          </span>
        </header>

        {messages.length === 0 ? (
          <>
            <EmptyState
              icon="🤖"
              title="Ada yang ingin ditanyakan?"
              description="Saya bisa membantu soal tidur, hidrasi, aktivitas, mood, dan kebiasaan Anda."
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  style={{
                    minHeight: 44, padding: "10px 14px", textAlign: "left", cursor: "pointer",
                    borderRadius: "var(--ah-r-inner)", border: "1px solid var(--ah-border)",
                    background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", fontSize: 13,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div role="log" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "86%",
                  background: m.role === "user"
                    ? "var(--ah-gradient-hero)"
                    : m.redFlag ? "var(--ah-surface-2)" : "var(--ah-surface-1)",
                  border: m.redFlag ? "1.5px solid var(--ah-score-low)" : "1px solid var(--ah-border)",
                  borderRadius: "var(--ah-r-inner)",
                  padding: "10px 12px",
                  color: m.role === "user" ? "#fff" : "var(--ah-text-primary)",
                  fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap",
                }}
              >
                {m.redFlag && (
                  <p style={{ fontSize: 11, fontWeight: 800, color: "var(--ah-score-low)", marginBottom: 4 }}>
                    PERLU PENANGANAN SEGERA
                  </p>
                )}
                {m.text}
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--ah-text-tertiary)", padding: "6px 4px" }}>
                Arta sedang mengetik…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </main>

      {/* composer + disclaimer permanen (CONTEXT §4) */}
      <div
        style={{
          position: "fixed", left: 0, right: 0, bottom: "calc(68px + env(safe-area-inset-bottom, 0px))",
          maxWidth: 400, margin: "0 auto", padding: "8px 16px",
          background: "var(--ah-bg)", borderTop: "1px solid var(--ah-border)",
          display: "flex", flexDirection: "column", gap: 6, zIndex: 30,
        }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); void send(input); }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pertanyaan Anda…"
            aria-label="Pertanyaan untuk Arta"
            style={{
              flex: 1, minHeight: 44, borderRadius: "var(--ah-r-full)", border: "1px solid var(--ah-border)",
              background: "var(--ah-surface-1)", color: "var(--ah-text-primary)", padding: "0 14px", fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            aria-label="Kirim"
            style={{
              width: 44, height: 44, borderRadius: "var(--ah-r-full)", border: "none", cursor: "pointer",
              background: "var(--ah-gradient-hero)", color: "#fff", fontSize: 16, fontWeight: 700,
              opacity: busy || !input.trim() ? 0.5 : 1,
            }}
          >
            ↑
          </button>
        </form>
        <p style={{ fontSize: 10, color: "var(--ah-text-tertiary)", textAlign: "center", lineHeight: 1.4 }}>
          {AI_DISCLAIMER}
        </p>
      </div>

      <QuickLogSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <AppNav activeKey="chat" onLog={() => setSheetOpen(true)} />
    </>
  );
}
