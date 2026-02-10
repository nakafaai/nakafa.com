import type { Theme } from "@repo/design-system/types/theme";

/**
 * Returns the color front for a given theme.
 * @param theme - The theme to get the color front for.
 * @returns The color front for the given theme.
 */
export function getColorFront(theme: Theme | string | undefined) {
  switch (theme) {
    case "light":
      return "#d87943";
    case "dark":
      return "#e78a53";
    case "system":
      return "#d87943";
    case "claude":
      return "#cb6441";
    case "tree":
      return "#8e9f4c";
    case "sunset":
      return "#ff8163";
    case "nature":
      return "#307b34";
    case "caffeine":
      return "#63493f";
    case "perpetuity":
      return "#18848c";
    case "neo":
      return "#ff3132";
    case "dreamy":
      return "#a78bfb";
    case "pinky":
      return "#e50a7a";
    case "retro":
      return "#d13781";
    case "cosmic":
      return "#6e55cf";
    case "tangerine":
      return "#df5e3a";
    case "solar":
      return "#b75301";
    case "windy":
      return "#395aa1";
    case "bubblegum":
      return "#d04f99";
    case "vintage":
      return "#a87c51";
    case "cute":
      return "#a74370";
    case "bean":
      return "#a27866";
    case "twitter":
      return "#1e9cf0";
    case "ghibli":
      return "#a3a85e";
    case "tokyo":
      return "#6127cd";
    case "notebook":
      return "#606060";
    case "popsicle":
      return "#4f46e5";
    case "luxury":
      return "#9b2c2c";
    case "shell":
      return "#3e43f0";
    case "matcha":
      return "#7c9082";
    case "pacman":
      return "#fbbf24";
    case "zelda":
      return "#d8a700";
    default:
      return "#d87943";
  }
}
