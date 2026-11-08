import { Match } from "effect";

/**
 * Neutral scene colors from the Tailwind CSS palette: surfaces, ink, grids, and
 * materials such as wood or stone. Every chromatic mark comes from the plot
 * palette in `@repo/design-system/lib/plot` instead.
 */
const COLORS = {
  GRAY: "#6b7280",
  NEUTRAL: "#737373",
  STONE: "#78716c",
  ZINC: "#71717a",
} as const;

const COLOR_SHADES = {
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
  SLATE: {
    50: "#f8fafc",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
  },
  STONE: {
    600: "#57534e",
  },
  ZINC: {
    100: "#f4f4f5",
    900: "#18181b",
    950: "#09090b",
  },
} as const;

const FIXED_COLORS = {
  BLACK: "#000000",
  WHITE: "#ffffff",
} as const;

type ColorName = keyof typeof COLORS;
type ShadeColorName = keyof typeof COLOR_SHADES;
type ColorShade<Color extends ShadeColorName> =
  keyof (typeof COLOR_SHADES)[Color];
type FixedColorName = keyof typeof FIXED_COLORS;
type ColorInput = ColorName | FixedColorName;
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
    GRAY: ([, shade]) => COLOR_SHADES.GRAY[shade],
    NEUTRAL: ([, shade]) => COLOR_SHADES.NEUTRAL[shade],
    SLATE: ([, shade]) => COLOR_SHADES.SLATE[shade],
    STONE: ([, shade]) => COLOR_SHADES.STONE[shade],
    ZINC: ([, shade]) => COLOR_SHADES.ZINC[shade],
  })
);

/**
 * Get a neutral color from the shared Tailwind palette.
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
