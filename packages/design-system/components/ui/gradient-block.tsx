"use client";

import { Array as Arr, Match } from "effect";
import type { CSSProperties, HTMLAttributes } from "react";
import { useMemo } from "react";

// Hashing constants
const HASH_PRIME_1 = 37;
const HASH_PRIME_2 = 17;
const HASH_MODULO = 10_000_000;
const HASH_SEED_1 = 23;
const HASH_SEED_2 = 41;
const HASH_SHIFT_LEFT = 5;
const HASH_SHIFT_RIGHT = 3;

// Color constants
const MAX_DEGREES = 360;
const HUE_OFFSET_MOD = 30;
const HUE_OFFSET_RANGE = 60;
const MAX_PERCENTAGE = 100;

// Gradient positioning constants
const RADIAL_POS_MOD_1 = 80;
const RADIAL_POS_MOD_2 = 20;
const RADIAL_POS_Y_MOD = 100;
const CONIC_CENTER = 50;
const CONIC_POS_MOD = 30;
const CONIC_POS_ADJ = 15;

// OKLCH adjustment constants
const LIGHTNESS_ADJ_1 = 0.05;
const LIGHTNESS_ADJ_2 = 0.1;
const CHROMA_ADJ_1 = 0.05;
const CHROMA_ADJ_2 = 0.02;
const MAX_CHROMA = 0.3;
const MIN_CHROMA = 0.05;
const MAX_LIGHTNESS = 0.95;
const MIN_LIGHTNESS = 0.4;

// Hue adjustment constants
const HUE_ADJ_ANALOGOUS_1 = 30;
const HUE_ADJ_ANALOGOUS_2 = 60;
const HUE_ADJ_COMPLEMENTARY_1 = 90;
const HUE_ADJ_COMPLEMENTARY_2 = 180;
const HUE_ADJ_SPLIT_1 = 150;
const HUE_ADJ_SPLIT_2 = 210;
const HUE_ADJ_TRIADIC_1 = 120;
const HUE_ADJ_TRIADIC_2 = 240;
const HUE_OFFSET_MONO = 15;
const HUE_OFFSET_ANALOGOUS_1 = 20;
const HUE_OFFSET_ANALOGOUS_2 = 30;
const COMPLEMENTARY_HUE_DIV = 2;

// Intensity constants
const SOFT_LIGHTNESS = 0.75;
const SOFT_CHROMA = 0.1;
const BOLD_LIGHTNESS = 0.65;
const BOLD_CHROMA = 0.2;
const MEDIUM_LIGHTNESS = 0.7;
const MEDIUM_CHROMA = 0.15;
const EMPTY_STYLE = {};

interface Props {
  className?: HTMLAttributes<HTMLDivElement>["className"];
  colorScheme?:
    | "complementary"
    | "analogous"
    | "triadic"
    | "monochromatic"
    | "split-complementary"
    | "vibrant";
  gradientType?: "linear" | "radial" | "conic";
  intensity?: "soft" | "medium" | "bold";
  keyString: string;
  style?: CSSProperties;
}

// Helper function to convert our color to OKLCH string
function oklch(lightness: number, chroma: number, hue: number): string {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

// Helper function to generate interpolated color stops
function generateColorStops(colors: string[]): string {
  // Add all colors as stops
  return Arr.join(
    Arr.map(colors, (color, i) => {
      const percentage = (i / (colors.length - 1)) * MAX_PERCENTAGE;
      return `${color} ${percentage}%`;
    }),
    ", "
  );
}

export function GradientBlock({
  keyString,
  className = "",
  style = EMPTY_STYLE,
  colorScheme = "monochromatic",
  intensity = "medium",
  gradientType = "linear",
}: Props) {
  // Generate a consistent color palette based on the keyString
  const gradientStyle = useMemo(() => {
    // Create a more unique hash from the keyString that produces better variation
    const hash = Arr.reduce(
      Array.from(keyString),
      HASH_SEED_1,
      (acc, char, index) => {
        // Use prime numbers, character code, character position, and bitwise operations
        // to create significantly more variation between similar strings
        const charCode = char.charCodeAt(0);
        const position = index + 1;
        // Use different prime numbers and bitwise operations for more randomness
        return (
          // biome-ignore lint/suspicious/noBitwiseOperators: Used for hashing
          ((acc * HASH_PRIME_1) ^ (charCode * position * HASH_PRIME_2)) %
          HASH_MODULO
        );
      }
    ); // Start with a prime seed for better distribution

    // Create a secondary hash value for additional variation
    const secondaryHash = Arr.reduce(
      Array.from(keyString),
      HASH_SEED_2,
      (acc, char, index) => {
        const charCode = char.charCodeAt(0);
        // Use a different algorithm for this hash
        return (
          (acc +
            // biome-ignore lint/suspicious/noBitwiseOperators: Used for hashing
            (charCode << (index % HASH_SHIFT_LEFT)) +
            // biome-ignore lint/suspicious/noBitwiseOperators: Used for hashing
            (charCode >> (index % HASH_SHIFT_RIGHT))) %
          HASH_MODULO
        );
      }
    ); // Different prime seed

    // Use both hashes to determine the base hue with more variation
    // biome-ignore lint/suspicious/noBitwiseOperators: Used for hashing
    const baseHue = (hash % MAX_DEGREES) ^ (secondaryHash % HUE_OFFSET_MOD);

    // Use the secondary hash for additional color adjustments
    const hueOffset = secondaryHash % HUE_OFFSET_RANGE;

    // OKLCH parameters based on intensity
    // Lightness (L): 0-1 scale (0 is black, 1 is white)
    // Chroma (C): 0+ scale (0 is gray, higher is more saturated)
    // Hue (H): 0-360 scale (same as HSL)
    const { baseL, baseC } = Match.value(intensity).pipe(
      Match.when("soft", () => ({ baseL: SOFT_LIGHTNESS, baseC: SOFT_CHROMA })),
      Match.when("bold", () => ({ baseL: BOLD_LIGHTNESS, baseC: BOLD_CHROMA })),
      Match.orElse(() => ({ baseL: MEDIUM_LIGHTNESS, baseC: MEDIUM_CHROMA }))
    );

    // Generate colors based on the selected color scheme
    const colors = Match.value(colorScheme).pipe(
      Match.when("vibrant", () => [
        // Create a vibrant, modern gradient with strategic color placement
        oklch(baseL, baseC, baseHue),
        oklch(
          baseL + LIGHTNESS_ADJ_1,
          Math.min(baseC + CHROMA_ADJ_1, MAX_CHROMA),
          (baseHue + HUE_ADJ_ANALOGOUS_1 + hueOffset) % MAX_DEGREES
        ),
        oklch(
          baseL - LIGHTNESS_ADJ_1,
          baseC,
          (baseHue + HUE_ADJ_ANALOGOUS_2 + hueOffset * 2) % MAX_DEGREES
        ),
      ]),
      Match.when("split-complementary", () => [
        // Base color and two colors on either side of its complement
        oklch(baseL, baseC, baseHue),
        oklch(
          baseL - LIGHTNESS_ADJ_1,
          baseC,
          (baseHue + HUE_ADJ_SPLIT_1 + hueOffset) % MAX_DEGREES
        ),
        oklch(
          baseL - LIGHTNESS_ADJ_2,
          baseC,
          (baseHue + HUE_ADJ_SPLIT_2 - hueOffset) % MAX_DEGREES
        ),
      ]),
      Match.when("complementary", () => [
        // Base color and its complement (180 degrees apart)
        oklch(baseL, baseC, baseHue),
        oklch(
          Math.min(baseL + LIGHTNESS_ADJ_1, MAX_LIGHTNESS),
          Math.max(baseC - CHROMA_ADJ_1, MIN_CHROMA),
          (baseHue +
            HUE_ADJ_COMPLEMENTARY_1 +
            hueOffset / COMPLEMENTARY_HUE_DIV) %
            MAX_DEGREES
        ),
        oklch(
          Math.max(baseL - LIGHTNESS_ADJ_1, MIN_LIGHTNESS),
          baseC,
          (baseHue + HUE_ADJ_COMPLEMENTARY_2 + hueOffset) % MAX_DEGREES
        ),
      ]),
      Match.when("triadic", () => [
        // Three colors evenly spaced (120 degrees apart)
        oklch(baseL, baseC, baseHue),
        oklch(
          Math.max(baseL - LIGHTNESS_ADJ_1, MIN_LIGHTNESS),
          baseC,
          (baseHue + HUE_ADJ_TRIADIC_1 + hueOffset) % MAX_DEGREES
        ),
        oklch(
          Math.max(baseL - LIGHTNESS_ADJ_2, MIN_LIGHTNESS),
          baseC,
          (baseHue + HUE_ADJ_TRIADIC_2 - hueOffset) % MAX_DEGREES
        ),
      ]),
      Match.when("monochromatic", () => [
        // Same hue, varying lightness and chroma
        oklch(
          Math.min(baseL + LIGHTNESS_ADJ_2, MAX_LIGHTNESS),
          Math.min(baseC + CHROMA_ADJ_1, MAX_CHROMA),
          (baseHue + (hueOffset % HUE_OFFSET_MONO)) % MAX_DEGREES
        ),
        oklch(baseL, baseC, baseHue),
        oklch(
          Math.max(baseL - LIGHTNESS_ADJ_2, MIN_LIGHTNESS),
          Math.max(baseC - CHROMA_ADJ_1, MIN_CHROMA),
          (baseHue - (hueOffset % HUE_OFFSET_MONO)) % MAX_DEGREES
        ),
      ]),
      Match.orElse(() => [
        // Analogous colors (adjacent on the color wheel)
        oklch(baseL, baseC, baseHue),
        oklch(
          Math.max(baseL - LIGHTNESS_ADJ_1, MIN_LIGHTNESS),
          Math.min(baseC + CHROMA_ADJ_2, MAX_CHROMA),
          (baseHue +
            HUE_ADJ_ANALOGOUS_1 +
            (hueOffset % HUE_OFFSET_ANALOGOUS_1)) %
            MAX_DEGREES
        ),
        oklch(
          Math.max(baseL - LIGHTNESS_ADJ_2, MIN_LIGHTNESS),
          baseC,
          (baseHue +
            HUE_ADJ_ANALOGOUS_2 +
            (hueOffset % HUE_OFFSET_ANALOGOUS_2)) %
            MAX_DEGREES
        ),
      ])
    );

    // Generate colorstops for the gradient
    const colorStops = generateColorStops(colors);

    // Generate different types of gradients based on gradientType
    // Use both hashes for more unique angles
    const angle =
      ((hash % HUE_ADJ_COMPLEMENTARY_2) +
        (secondaryHash % HUE_ADJ_COMPLEMENTARY_1)) %
      MAX_DEGREES;

    const gradientCss = Match.value(gradientType).pipe(
      Match.when("radial", () => {
        // Create a radial gradient with more variation in position
        const posX =
          (hash % RADIAL_POS_MOD_1) + (secondaryHash % RADIAL_POS_MOD_2);
        const posY =
          ((secondaryHash % RADIAL_POS_MOD_1) + (hash % RADIAL_POS_MOD_2)) %
          RADIAL_POS_Y_MOD;
        return `radial-gradient(circle at ${posX}% ${posY}%, ${colorStops})`;
      }),
      Match.when("conic", () => {
        // Create a conic gradient with more unique angle and position
        const conicX =
          CONIC_CENTER + ((secondaryHash % CONIC_POS_MOD) - CONIC_POS_ADJ);
        const conicY = CONIC_CENTER + ((hash % CONIC_POS_MOD) - CONIC_POS_ADJ);
        return `conic-gradient(from ${angle}deg at ${conicX}% ${conicY}%, ${colorStops})`;
      }),
      Match.orElse(
        // Create a linear gradient (default) with more unique angle
        () => `linear-gradient(${angle}deg, ${colorStops})`
      )
    );

    // Create additional styles for conic gradients to assist with anti-aliasing
    const additionalStyles =
      gradientType === "conic"
        ? {
            // Apply multiple rendering enhancements for conic gradients:
            transform: "translateZ(0)", // Force GPU acceleration
            backfaceVisibility: "hidden" as const, // Improve rendering
            perspective: "1000px", // Help with anti-aliasing
            // Add a very subtle inner shadow to soften hard edges
            boxShadow: "inset 0 0 30px rgba(0,0,0,0.05)",
          }
        : {};

    return {
      backgroundImage: gradientCss,
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center center",
      ...additionalStyles,
      ...style,
    };
  }, [keyString, style, colorScheme, intensity, gradientType]);

  return <div aria-hidden className={className} style={gradientStyle} />;
}
