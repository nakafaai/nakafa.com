import Color from "colorjs.io";

/** Foreground and surface roles that must support normal-sized text. */
export const TEXT_ROLE_PAIRS = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "muted"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
];

const CHART_NAMES = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

/** Familiar semantic hue families with room for theme-local saturation. */
export const STATUS_COLOR_FAMILIES = {
  destructive: { maximumHue: 35, minimumChroma: 0.1, minimumHue: 0 },
  info: { maximumHue: 265, minimumChroma: 0.07, minimumHue: 200 },
  success: { maximumHue: 190, minimumChroma: 0.07, minimumHue: 145 },
  warning: { maximumHue: 105, minimumChroma: 0.08, minimumHue: 55 },
} as const;

/** Essential focus and chart roles that require 3:1 against their surfaces. */
export const NON_TEXT_ROLE_PAIRS = [
  ...CHART_NAMES.flatMap((chart) => [
    [chart, "background", "essential chart mark on the page surface"],
    [chart, "card", "essential chart mark on a card surface"],
  ]),
  ["ring", "background", "focus indicator on the page surface"],
  ["ring", "card", "focus indicator on a card surface"],
  ["ring", "popover", "focus indicator on a popover surface"],
  ["sidebar-ring", "sidebar", "focus indicator on the sidebar surface"],
  [
    "sidebar-ring",
    "background",
    "focus indicator on a page-backed sidebar control",
  ],
  ["sidebar-ring", "sidebar-accent", "focus indicator on active sidebar"],
];

/** Semantic colors used directly as normal-sized text on common surfaces. */
export const STANDALONE_TEXT_ROLE_PAIRS = [
  ["foreground", "muted", "foreground text on a muted surface"],
  ["primary", "background", "primary-colored text on the page surface"],
  ["primary", "card", "primary-colored text on a card surface"],
  ["destructive", "background", "destructive text on the page surface"],
  ["destructive", "card", "destructive text on a card surface"],
  ["destructive", "popover", "destructive text on a popover surface"],
  ["muted-foreground", "background", "muted text on the page surface"],
  ["muted-foreground", "card", "muted text on a card surface"],
  ["muted-foreground", "popover", "muted text on a popover surface"],
];

/** Calculates a full-precision WCAG 2.1 ratio through Color.js. */
export function getWcagContrast(color: string, against: string) {
  return Color.contrastWCAG21(new Color(against), new Color(color));
}
