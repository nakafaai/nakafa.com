"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { useMemo } from "react";

type Props = {
  keyString: string;
  className?: HTMLAttributes<HTMLDivElement>["className"];
  style?: CSSProperties;
  colorScheme?:
    | "complementary"
    | "analogous"
    | "triadic"
    | "monochromatic"
    | "split-complementary"
    | "vibrant";
  intensity?: "soft" | "medium" | "bold";
  gradientType?: "linear" | "radial" | "conic";
};

// Helper function to convert our color to OKLCH string
function oklch(lightness: number, chroma: number, hue: number): string {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

// Helper function to generate interpolated color stops
function generateColorStops(colors: string[]): string {
  const result: string[] = [];

  // Add all colors as stops
  for (let i = 0; i < colors.length; i++) {
    const percentage = (i / (colors.length - 1)) * 100;
    result.push(`${colors[i]} ${percentage}%`);
  }

  return result.join(", ");
}

export function GradientBlock({
  keyString,
  className = "",
  style = {},
  colorScheme = "monochromatic",
  intensity = "medium",
  gradientType = "linear",
}: Props) {
  // Generate a consistent color palette based on the keyString
  const gradientStyle = useMemo(() => {
    // Create a more unique hash from the keyString that produces better variation
    const hash = Array.from(keyString).reduce((acc, char, index) => {
      // Use prime numbers, character code, character position, and bitwise operations
      // to create significantly more variation between similar strings
      const charCode = char.charCodeAt(0);
      const position = index + 1;
      // Use different prime numbers and bitwise operations for more randomness
      return ((acc * 37) ^ (charCode * position * 17)) % 10000000;
    }, 23); // Start with a prime seed for better distribution

    // Create a secondary hash value for additional variation
    const secondaryHash = Array.from(keyString).reduce((acc, char, index) => {
      const charCode = char.charCodeAt(0);
      // Use a different algorithm for this hash
      return (
        (acc + (charCode << (index % 5)) + (charCode >> (index % 3))) % 10000000
      );
    }, 41); // Different prime seed

    // Use both hashes to determine the base hue with more variation
    const baseHue = (hash % 360) ^ (secondaryHash % 30);

    // Use the secondary hash for additional color adjustments
    const hueOffset = secondaryHash % 60;

    // OKLCH parameters based on intensity
    // Lightness (L): 0-1 scale (0 is black, 1 is white)
    // Chroma (C): 0+ scale (0 is gray, higher is more saturated)
    // Hue (H): 0-360 scale (same as HSL)
    let baseL = 0.7; // Default lightness
    let baseC = 0.15; // Default chroma (saturation)

    switch (intensity) {
      case "soft": {
        baseL = 0.75;
        baseC = 0.1;
        break;
      }
      case "bold": {
        baseL = 0.65;
        baseC = 0.2;
        break;
      }
      default: {
        // medium
        baseL = 0.7;
        baseC = 0.15;
        break;
      }
    }

    let colors: string[] = [];

    // Generate colors based on the selected color scheme
    switch (colorScheme) {
      case "vibrant":
        // Create a vibrant, modern gradient with strategic color placement
        colors = [
          oklch(baseL, baseC, baseHue),
          oklch(
            baseL + 0.05,
            Math.min(baseC + 0.05, 0.3),
            (baseHue + 30 + hueOffset) % 360
          ),
          oklch(baseL - 0.05, baseC, (baseHue + 60 + hueOffset * 2) % 360),
        ];
        break;

      case "split-complementary":
        // Base color and two colors on either side of its complement
        colors = [
          oklch(baseL, baseC, baseHue),
          oklch(baseL - 0.05, baseC, (baseHue + 150 + hueOffset) % 360),
          oklch(baseL - 0.1, baseC, (baseHue + 210 - hueOffset) % 360),
        ];
        break;

      case "complementary":
        // Base color and its complement (180 degrees apart)
        colors = [
          oklch(baseL, baseC, baseHue),
          oklch(
            Math.min(baseL + 0.05, 0.95),
            Math.max(baseC - 0.05, 0.05),
            (baseHue + 90 + hueOffset / 2) % 360
          ),
          oklch(
            Math.max(baseL - 0.05, 0.4),
            baseC,
            (baseHue + 180 + hueOffset) % 360
          ),
        ];
        break;

      case "triadic":
        // Three colors evenly spaced (120 degrees apart)
        colors = [
          oklch(baseL, baseC, baseHue),
          oklch(
            Math.max(baseL - 0.05, 0.4),
            baseC,
            (baseHue + 120 + hueOffset) % 360
          ),
          oklch(
            Math.max(baseL - 0.1, 0.4),
            baseC,
            (baseHue + 240 - hueOffset) % 360
          ),
        ];
        break;

      case "monochromatic":
        // Same hue, varying lightness and chroma
        colors = [
          oklch(
            Math.min(baseL + 0.1, 0.95),
            Math.min(baseC + 0.05, 0.3),
            (baseHue + (hueOffset % 15)) % 360
          ),
          oklch(baseL, baseC, baseHue),
          oklch(
            Math.max(baseL - 0.1, 0.4),
            Math.max(baseC - 0.05, 0.05),
            (baseHue - (hueOffset % 15)) % 360
          ),
        ];
        break;

      default:
        // Analogous colors (adjacent on the color wheel)
        colors = [
          oklch(baseL, baseC, baseHue),
          oklch(
            Math.max(baseL - 0.05, 0.4),
            Math.min(baseC + 0.02, 0.3),
            (baseHue + 30 + (hueOffset % 20)) % 360
          ),
          oklch(
            Math.max(baseL - 0.1, 0.4),
            baseC,
            (baseHue + 60 + (hueOffset % 30)) % 360
          ),
        ];
        break;
    }

    // Generate colorstops for the gradient
    const colorStops = generateColorStops(colors);

    // Generate different types of gradients based on gradientType
    let gradientCss = "";
    // Use both hashes for more unique angles
    const angle = ((hash % 180) + (secondaryHash % 90)) % 360;

    switch (gradientType) {
      case "radial": {
        // Create a radial gradient with more variation in position
        const posX = (hash % 80) + (secondaryHash % 20);
        const posY = ((secondaryHash % 80) + (hash % 20)) % 100;
        gradientCss = `radial-gradient(circle at ${posX}% ${posY}%, ${colorStops})`;
        break;
      }
      case "conic": {
        // Create a conic gradient with more unique angle and position
        const conicX = 50 + ((secondaryHash % 30) - 15);
        const conicY = 50 + ((hash % 30) - 15);
        gradientCss = `conic-gradient(from ${angle}deg at ${conicX}% ${conicY}%, ${colorStops})`;
        break;
      }
      default:
        // Create a linear gradient (default) with more unique angle
        gradientCss = `linear-gradient(${angle}deg, ${colorStops})`;
        break;
    }

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

  return (
    <div
      className={className}
      style={gradientStyle}
      aria-label={`Gradient generated from key: ${keyString}`}
      aria-hidden
    />
  );
}
