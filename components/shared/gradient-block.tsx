"use client";

import type { CSSProperties, HTMLAttributes } from "react";
import { useMemo } from "react";
import tinycolor from "tinycolor2";
import tinygradient from "tinygradient";

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

    // Determine saturation and lightness based on intensity
    let baseSaturation = 0.7;
    let baseLightness = 0.5;

    switch (intensity) {
      case "soft": {
        baseSaturation = 0.6;
        baseLightness = 0.6;
        break;
      }
      case "bold": {
        baseSaturation = 0.85;
        baseLightness = 0.45;
        break;
      }
      default: {
        // medium
        baseSaturation = 0.75;
        baseLightness = 0.6;
        break;
      }
    }

    let colors: tinycolor.Instance[] = [];

    // Generate colors based on the selected color scheme
    switch (colorScheme) {
      case "vibrant":
        // Create a vibrant, modern gradient with strategic color placement
        colors = [
          tinycolor({ h: baseHue, s: baseSaturation, l: baseLightness }),
          tinycolor({
            h: (baseHue + 30 + hueOffset) % 360,
            s: Math.min(baseSaturation + 0.1, 1),
            l: baseLightness,
          }),
          tinycolor({
            h: (baseHue + 60 + hueOffset * 2) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
        ];
        break;

      case "split-complementary":
        // Base color and two colors on either side of its complement
        colors = [
          tinycolor({ h: baseHue, s: baseSaturation, l: baseLightness }),
          tinycolor({
            h: (baseHue + 150 + hueOffset) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
          tinycolor({
            h: (baseHue + 210 - hueOffset) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.15, 0),
          }),
        ];
        break;

      case "complementary":
        // Base color and its complement (180 degrees apart)
        colors = [
          tinycolor({ h: baseHue, s: baseSaturation, l: baseLightness }),
          tinycolor({
            h: (baseHue + 90 + hueOffset / 2) % 360,
            s: Math.min(baseSaturation - 0.1, 1),
            l: Math.min(baseLightness + 0.1, 1),
          }),
          tinycolor({
            h: (baseHue + 180 + hueOffset) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
        ];
        break;

      case "triadic":
        // Three colors evenly spaced (120 degrees apart)
        colors = [
          tinycolor({ h: baseHue, s: baseSaturation, l: baseLightness }),
          tinycolor({
            h: (baseHue + 120 + hueOffset) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
          tinycolor({
            h: (baseHue + 240 - hueOffset) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.15, 0),
          }),
        ];
        break;

      case "monochromatic":
        // Same hue, varying saturation and lightness
        colors = [
          tinycolor({
            h: (baseHue + (hueOffset % 15)) % 360, // Small hue variation for more uniqueness
            s: Math.min(baseSaturation + 0.2, 1),
            l: Math.min(baseLightness + 0.2, 1),
          }),
          tinycolor({ h: baseHue, s: baseSaturation, l: baseLightness }),
          tinycolor({
            h: (baseHue - (hueOffset % 15)) % 360, // Small hue variation for more uniqueness
            s: Math.max(baseSaturation - 0.2, 0),
            l: Math.max(baseLightness - 0.2, 0),
          }),
        ];
        break;

      default:
        // Analogous colors (adjacent on the color wheel)
        colors = [
          tinycolor({ h: baseHue, s: baseSaturation, l: baseLightness }),
          tinycolor({
            h: (baseHue + 30 + (hueOffset % 20)) % 360,
            s: Math.min(baseSaturation + 0.05, 1),
            l: Math.max(baseLightness - 0.05, 0),
          }),
          tinycolor({
            h: (baseHue + 60 + (hueOffset % 30)) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
        ];
        break;
    }

    // Create a gradient using tinygradient
    const gradient = tinygradient(colors);

    // Get color stops with more detail for smoother transitions
    const colorStops = gradient
      .rgb(7) // Significantly increase color stops for maximum smoothness
      .map((color) => color.toRgbString())
      .join(", ");

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
