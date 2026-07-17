export function SkeletonCard({ height = 96 }: { height?: number }) {
  return (
    <div aria-hidden style={{ background: "var(--ah-surface-1)", border: "1px solid var(--ah-border)", borderRadius: "var(--ah-r-card)", height, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(148,163,208,0.08), transparent)", animation: "ah-shimmer 1.4s infinite" }} />
      <style>{`@keyframes ah-shimmer { from { transform: translateX(-100%);} to { transform: translateX(100%);} }`}</style>
    </div>
  );
}
