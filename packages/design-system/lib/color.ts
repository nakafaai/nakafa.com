/**
 * COLORS constant
 *
 * All colors are taken from Tailwind CSS's palette at the -500 shade.
 * For example, RED is tailwind's red-500, BLUE is blue-500, etc.
 */
export const COLORS = {
  RED: "#dc2626", // tailwind red-500
  ORANGE: "#ea580c", // tailwind orange-500
  AMBER: "#d97706", // tailwind amber-500
  YELLOW: "#ca8a04", // tailwind yellow-500
  LIME: "#65a30d", // tailwind lime-500
  GREEN: "#16a34a", // tailwind green-500
  EMERALD: "#059669", // tailwind emerald-500
  TEAL: "#0d9488", // tailwind teal-500
  CYAN: "#0891b2", // tailwind cyan-500
  SKY: "#0284c7", // tailwind sky-500
  BLUE: "#2563eb", // tailwind blue-500
  INDIGO: "#4f46e5", // tailwind indigo-500
  VIOLET: "#7c3aed", // tailwind violet-500
  PURPLE: "#9333ea", // tailwind purple-500
  FUCHSIA: "#c026d3", // tailwind fuchsia-500
  PINK: "#db2777", // tailwind pink-500
  ROSE: "#e11d48", // tailwind rose-500
  SLATE: "#64748b", // tailwind slate-500
  GRAY: "#6b7280", // tailwind gray-500
  ZINC: "#71717a", // tailwind zinc-500
  NEUTRAL: "#737373", // tailwind neutral-500
  STONE: "#78716c", // tailwind stone-500
};

// Define a constant array of color keys at module level
const COLOR_KEYS = Object.keys(COLORS) as Array<keyof typeof COLORS>;

/**
 * Get a color from the COLORS object
 * @param color - The key of the color to get
 * @returns The color value
 */
export function getColor(color: keyof typeof COLORS) {
  return COLORS[color.toUpperCase() as keyof typeof COLORS];
}

/**
 * Get a random color from the COLORS object
 * @param exclude - The keys of the colors to exclude
 * @param seed - A seed for deterministic selection
 * @returns The random color value
 */
export function randomColor(
  exclude?: (keyof typeof COLORS)[],
  seed?: string | number
) {
  const availableKeys = COLOR_KEYS.filter(
    (key) => !exclude?.some((excludeKey) => excludeKey === key)
  );

  if (availableKeys.length === 0) {
    return COLORS[COLOR_KEYS[0]];
  }

  // Deterministic hash-based selection
  let seedNum = 0;
  if (typeof seed === "number") {
    seedNum = seed;
  } else if (seed) {
    seedNum = Array.from(seed).reduce(
      (acc, char) => acc + char.charCodeAt(0),
      0
    );
  }
  const index = seedNum % availableKeys.length;

  return COLORS[availableKeys[index]];
}
