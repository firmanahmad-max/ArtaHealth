/** Tailwind preset — memetakan token CSS vars ke utility. Dipakai apps/web. */
module.exports = {
  theme: {
    extend: {
      colors: {
        "ah-bg": "var(--ah-bg)",
        "ah-surface-1": "var(--ah-surface-1)",
        "ah-surface-2": "var(--ah-surface-2)",
        "ah-border": "var(--ah-border)",
        "ah-blue": "var(--ah-blue)", "ah-cyan": "var(--ah-cyan)", "ah-purple": "var(--ah-purple)",
        "ah-text-primary": "var(--ah-text-primary)",
        "ah-text-secondary": "var(--ah-text-secondary)",
        "ah-text-tertiary": "var(--ah-text-tertiary)",
        "ah-excellent": "var(--ah-score-excellent)", "ah-good": "var(--ah-score-good)",
        "ah-fair": "var(--ah-score-fair)", "ah-low": "var(--ah-score-low)",
        "ah-sleep": "var(--ah-sleep)", "ah-hydration": "var(--ah-hydration)",
        "ah-activity": "var(--ah-activity)", "ah-nutrition": "var(--ah-nutrition)",
        "ah-mood": "var(--ah-mood)", "ah-heart": "var(--ah-heart)", "ah-medical": "var(--ah-medical)"
      },
      borderRadius: { card: "20px", inner: "14px", chip: "10px" }
    }
  }
};
