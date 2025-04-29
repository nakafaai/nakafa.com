export const COLORS = {
  RED: "#dc2626",
  ORANGE: "#ea580c",
  EMBER: "#d97706",
  YELLOW: "#ca8a04",
  LIME: "#65a30d",
  GREEN: "#16a34a",
  EMERALD: "#059669",
  TEAL: "#0d9488",
  CYAN: "#0891b2",
  SKY: "#0284c7",
  BLUE: "#2563eb",
  INDIGO: "#4f46e5",
  VIOLET: "#7c3aed",
  PURPLE: "#9333ea",
  FUCHSIA: "#c026d3",
  PINK: "#db2777",
  ROSE: "#e11d48",
};

// Define a constant array of color keys at module level
const COLOR_KEYS = Object.keys(COLORS) as Array<keyof typeof COLORS>;

/**
 * Get a color from the COLORS object
 * @param color - The key of the color to get
 * @returns The color value
 */
export function getColor(color: keyof typeof COLORS) {
  return COLORS[color];
}

/**
 * Get a random color from the COLORS object
 * @param exclude - The keys of the colors to exclude
 * @returns The random color value
 */
export function randomColor(exclude?: (keyof typeof COLORS)[]) {
  // Filter the keys in a type-safe way
  const availableKeys = COLOR_KEYS.filter(
    (key) => !exclude || !exclude.some((excludeKey) => excludeKey === key)
  );

  // Handle the case where all colors are excluded
  if (availableKeys.length === 0) {
    return COLORS[COLOR_KEYS[0]]; // Return first color as fallback
  }

  return COLORS[
    availableKeys[Math.floor(Math.random() * availableKeys.length)]
  ];
}
