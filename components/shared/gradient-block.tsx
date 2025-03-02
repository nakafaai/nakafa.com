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
};

export function GradientBlock({
  keyString,
  className = "",
  style = {},
  colorScheme = "vibrant",
  intensity = "medium",
}: Props) {
  // Generate a consistent color palette based on the keyString
  const gradientStyle = useMemo(() => {
    // Create a simple hash from the keyString
    const hash = Array.from(keyString).reduce(
      (acc, char) => acc + char.charCodeAt(0),
      0
    );

    // Use the hash to determine the base hue
    const baseHue = hash % 360;

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
        baseLightness = 0.5;
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
            h: (baseHue + 25) % 360,
            s: Math.min(baseSaturation + 0.1, 1),
            l: baseLightness,
          }),
          tinycolor({
            h: (baseHue + 50) % 360,
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
            h: (baseHue + 150) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
          tinycolor({
            h: (baseHue + 210) % 360,
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
            h: (baseHue + 90) % 360,
            s: Math.min(baseSaturation - 0.1, 1),
            l: Math.min(baseLightness + 0.1, 1),
          }),
          tinycolor({
            h: (baseHue + 180) % 360,
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
            h: (baseHue + 120) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
          tinycolor({
            h: (baseHue + 240) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.15, 0),
          }),
        ];
        break;

      case "monochromatic":
        // Same hue, varying saturation and lightness
        colors = [
          tinycolor({
            h: baseHue,
            s: Math.min(baseSaturation + 0.2, 1),
            l: Math.min(baseLightness + 0.2, 1),
          }),
          tinycolor({ h: baseHue, s: baseSaturation, l: baseLightness }),
          tinycolor({
            h: baseHue,
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
            h: (baseHue + 30) % 360,
            s: Math.min(baseSaturation + 0.05, 1),
            l: Math.max(baseLightness - 0.05, 0),
          }),
          tinycolor({
            h: (baseHue + 60) % 360,
            s: baseSaturation,
            l: Math.max(baseLightness - 0.1, 0),
          }),
        ];
        break;
    }

    // Create a gradient using tinygradient
    const gradient = tinygradient(colors);

    // Generate CSS for a linear gradient
    // Use a more varied angle for visual interest
    const angle = ((hash % 180) + (hash % 60)) % 360; // More variety in angles

    // Apply a subtle pattern overlay for more depth
    const gradientCss = `linear-gradient(${angle}deg, ${gradient
      .rgb(5) // Get 5 color stops for smooth transition
      .map((color) => color.toRgbString())
      .join(", ")})`;

    return {
      backgroundImage: gradientCss,
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center center",
      ...style,
    };
  }, [keyString, style, colorScheme, intensity]);

  return (
    <div
      className={className}
      style={gradientStyle}
      aria-label={`Gradient generated from key: ${keyString}`}
    />
  );
}
