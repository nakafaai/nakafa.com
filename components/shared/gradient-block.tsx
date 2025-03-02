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
  colorScheme = "vibrant",
  intensity = "medium",
  gradientType = "radial",
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

    // Get color stops with more detail for smoother transitions
    const colorStops = gradient
      .rgb(7) // Significantly increase color stops for maximum smoothness
      .map((color) => color.toRgbString())
      .join(", ");

    // Generate different types of gradients based on gradientType
    let gradientCss = "";
    const angle = ((hash % 180) + (hash % 60)) % 360; // More variety in angles

    switch (gradientType) {
      case "radial":
        // Create a radial gradient
        gradientCss = `radial-gradient(circle at ${hash % 100}% ${hash % 100}%, ${colorStops})`;
        break;
      case "conic":
        // Create a conic gradient
        gradientCss = `conic-gradient(from ${angle}deg at 50% 50%, ${colorStops})`;
        break;
      default:
        // Create a linear gradient (default)
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
    />
  );
}
