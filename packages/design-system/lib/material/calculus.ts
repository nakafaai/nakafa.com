/**
 * The plotted colors of the calculus, vector and linear-method coordinate
 * labs, one set per appearance. Each hue keeps clear of the red, green and
 * blue that belong to the X, Y and Z axes, and stands out on its own card:
 * deep on the light card, bright on the dark one.
 */
export const CALCULUS_COLORS = {
  dark: {
    accent: "#fbbf24",
    alert: "#f472b6",
    curve: "#818cf8",
    cut: "#fb923c",
    envelope: "#a3e635",
    guide: "#94a3b8",
    ink: "#e2e8f0",
    normal: "#c084fc",
    plane: "#22d3ee",
    slope: "#2dd4bf",
  },
  light: {
    accent: "#d97706",
    alert: "#db2777",
    curve: "#4338ca",
    cut: "#c2410c",
    envelope: "#4d7c0f",
    guide: "#64748b",
    ink: "#1e293b",
    normal: "#9333ea",
    plane: "#0891b2",
    slope: "#0f766e",
  },
} as const;
