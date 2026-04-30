/** Shared neutral colors for Three.js labels and helper geometry. */
export const ORIGIN_COLOR = {
  LIGHT: "#f4f4f5",
  DARK: "#18181b",
};

/** Font URL used by Drei Text inside WebGL scenes. */
export const FONT_PATH = "/fonts/Geist-Regular.ttf";

/** Monospace font URL used by technical Three.js labels. */
export const MONO_FONT_PATH = "/fonts/GeistMono-Regular.ttf";

/** Shared Three.js font sizes in world units, not CSS pixels. */
export const THREE_FONT_SIZE = {
  marker: 0.08,
  compact: 0.12,
  annotation: 0.14,
  reading: 0.24,
  display: 0.34,
  diagram: 0.5,
};

export type ThreeFontSize = keyof typeof THREE_FONT_SIZE;

const PARTICLE_LABEL_FONT_RATIO = 0.72;

/**
 * Resolves shared 3D typography tokens while keeping a numeric escape hatch.
 */
export function resolveThreeFontSize(fontSize: ThreeFontSize | number) {
  if (typeof fontSize === "number") {
    return fontSize;
  }

  return THREE_FONT_SIZE[fontSize];
}

/**
 * Keeps labels inside small 3D particles readable without letting text overflow.
 */
export function getThreeParticleLabelFontSize(radius: number) {
  return Math.min(radius * PARTICLE_LABEL_FONT_RATIO, THREE_FONT_SIZE.marker);
}
