import { Schema } from "effect";

/**
 * The seven colors a plotted mark may take: every curve, point, vector,
 * region, solid, and chart series of a lesson. Red, green, and blue belong to
 * the X, Y, and Z axes alone, so each plot hue stands at least 30 degrees of
 * OKLCH hue away from all three.
 */
export const PlotColorSchema = Schema.Literals([
  "amber",
  "fuchsia",
  "orange",
  "pink",
  "slate",
  "teal",
  "violet",
]);
type PlotColor = typeof PlotColorSchema.Type;

/**
 * One value per plot color, chosen to keep 3:1 against both the light and the
 * dark card, so a scene draws the same mark in either appearance.
 */
export const PLOT_COLORS = {
  amber: "#b98d00",
  fuchsia: "#c026d3",
  orange: "#bb6800",
  pink: "#e03b8a",
  slate: "#64748b",
  teal: "#0d9488",
  violet: "#8242e5",
} as const satisfies Record<PlotColor, string>;

/** The X, Y, and Z axis colors, which no plotted mark may resemble. */
export const AXIS_COLORS = {
  x: "#dc2626",
  y: "#16a34a",
  z: "#2563eb",
} as const;
