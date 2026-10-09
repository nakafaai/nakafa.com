import { Match } from "effect";

/** Default visualization accents from the Tailwind CSS palette. */
const COLOR_KEYS = [
  "AMBER",
  "BLUE",
  "CYAN",
  "EMERALD",
  "FUCHSIA",
  "GRAY",
  "GREEN",
  "INDIGO",
  "LIME",
  "NEUTRAL",
  "ORANGE",
  "PINK",
  "PURPLE",
  "RED",
  "ROSE",
  "SKY",
  "SLATE",
  "STONE",
  "TEAL",
  "VIOLET",
  "YELLOW",
  "ZINC",
] as const;

export type ColorName = (typeof COLOR_KEYS)[number];

export const COLORS = {
  AMBER: "#d97706",
  BLUE: "#2563eb",
  CYAN: "#0891b2",
  EMERALD: "#059669",
  FUCHSIA: "#c026d3",
  GRAY: "#6b7280",
  GREEN: "#16a34a",
  INDIGO: "#4f46e5",
  LIME: "#65a30d",
  NEUTRAL: "#737373",
  ORANGE: "#ea580c",
  PINK: "#db2777",
  PURPLE: "#9333ea",
  RED: "#dc2626",
  ROSE: "#e11d48",
  SKY: "#0284c7",
  SLATE: "#64748b",
  STONE: "#78716c",
  TEAL: "#0d9488",
  VIOLET: "#7c3aed",
  YELLOW: "#ca8a04",
  ZINC: "#71717a",
} as const satisfies Record<ColorName, string>;

const COLOR_SHADES = {
  AMBER: {
    100: "#fef3c7",
    200: "#fde68a",
    500: "#f59e0b",
  },
  BLUE: {
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
  },
  EMERALD: {
    100: "#d1fae5",
  },
  GRAY: {
    200: "#e5e7eb",
    300: "#d1d5db",
    700: "#374151",
    800: "#1f2937",
  },
  NEUTRAL: {
    200: "#e5e5e5",
    300: "#d4d4d4",
    700: "#404040",
    800: "#262626",
  },
  ORANGE: {
    500: "#f97316",
  },
  RED: {
    500: "#ef4444",
  },
  SKY: {
    400: "#38bdf8",
  },
  SLATE: {
    50: "#f8fafc",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
  STONE: {
    600: "#57534e",
  },
  TEAL: {
    500: "#14b8a6",
    700: "#0f766e",
  },
  VIOLET: {
    500: "#8b5cf6",
  },
  ZINC: {
    100: "#f4f4f5",
    900: "#18181b",
    950: "#09090b",
  },
} as const;

export const FIXED_COLORS = {
  BLACK: "#000000",
  WHITE: "#ffffff",
} as const;

type ShadeColorName = keyof typeof COLOR_SHADES;
type ColorShade<Color extends ShadeColorName> =
  keyof (typeof COLOR_SHADES)[Color];
export type FixedColorName = keyof typeof FIXED_COLORS;
export type ColorInput = ColorName | FixedColorName;
const COLOR_VALUES = {
  ...COLORS,
  ...FIXED_COLORS,
} as const satisfies Record<ColorInput, string>;
type ShadeColorArgs = {
  [Color in ShadeColorName]: [color: Color, shade: ColorShade<Color>];
}[ShadeColorName];
type ColorArgs = [color: ColorInput] | ShadeColorArgs;

/** Reads one shade. Each color owns its own set of shades. */
const readShade = Match.type<ShadeColorArgs>().pipe(
  Match.discriminatorsExhaustive("0")({
    AMBER: ([, shade]) => COLOR_SHADES.AMBER[shade],
    BLUE: ([, shade]) => COLOR_SHADES.BLUE[shade],
    EMERALD: ([, shade]) => COLOR_SHADES.EMERALD[shade],
    GRAY: ([, shade]) => COLOR_SHADES.GRAY[shade],
    NEUTRAL: ([, shade]) => COLOR_SHADES.NEUTRAL[shade],
    ORANGE: ([, shade]) => COLOR_SHADES.ORANGE[shade],
    RED: ([, shade]) => COLOR_SHADES.RED[shade],
    SKY: ([, shade]) => COLOR_SHADES.SKY[shade],
    SLATE: ([, shade]) => COLOR_SHADES.SLATE[shade],
    STONE: ([, shade]) => COLOR_SHADES.STONE[shade],
    TEAL: ([, shade]) => COLOR_SHADES.TEAL[shade],
    VIOLET: ([, shade]) => COLOR_SHADES.VIOLET[shade],
    ZINC: ([, shade]) => COLOR_SHADES.ZINC[shade],
  })
);

/**
 * Get a color from the shared Tailwind palette.
 * @param color - The key of the color to get
 * @param shade - Optional Tailwind shade
 * @returns The color value
 */
export function getColor(...args: ColorArgs) {
  if (args.length === 1) {
    return COLOR_VALUES[args[0]];
  }

  return readShade(args);
}
