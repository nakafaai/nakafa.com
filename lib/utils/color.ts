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
