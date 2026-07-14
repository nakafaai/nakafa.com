import { fileURLToPath } from "node:url";
import { FileSystem } from "@effect/platform";
import Color from "colorjs.io";
import { Effect, Schema } from "effect";
import postcss, { type AtRule, type Root, type Rule } from "postcss";

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

/** Opaque component and chart roles that require 3:1 against their surfaces. */
export const NON_TEXT_ROLE_PAIRS = [
  ...CHART_NAMES.flatMap((chart) => [
    [chart, "background", "essential chart mark on the page surface"],
    [chart, "card", "essential chart mark on a card surface"],
  ]),
  ["ring", "background", "focus indicator on the page surface"],
  ["ring", "card", "focus indicator on a card surface"],
  ["ring", "popover", "focus indicator on a popover surface"],
  ["input", "background", "unchecked control on the page surface"],
  ["input", "card", "unchecked control on a card surface"],
  ["input", "popover", "unchecked control on a popover surface"],
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

/** Complete semantic color surface shared by every concrete profile. */
export const SEMANTIC_COLOR_TOKENS = [
  ...TEXT_ROLE_PAIRS.flatMap(([foreground, surface]) => [
    `--${surface}`,
    `--${foreground}`,
  ]),
  "--border",
  "--input",
  "--ring",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar-border",
  "--sidebar-ring",
];

/** Required profile declarations: 38 colors, one radius, and eight shadows. */
export const REQUIRED_THEME_TOKENS = [
  ...SEMANTIC_COLOR_TOKENS,
  "--radius",
  "--shadow-2xs",
  "--shadow-xs",
  "--shadow-sm",
  "--shadow",
  "--shadow-md",
  "--shadow-lg",
  "--shadow-xl",
  "--shadow-2xl",
];

/** Theme-local properties allowed alongside the 47 required core declarations. */
export const THEME_METADATA_PROPERTIES = [
  "color-scheme",
  "--font-mono",
  "--font-sans",
  "--font-serif",
  "--shadow-color",
];

/** A concrete theme selector and the stylesheet that must directly own it. */
export interface ProfileSource {
  readonly name: string;
  readonly root: Root;
  readonly selector: string;
}

/** Parsed owners for the official pair and selectable named profiles. */
export interface ThemeStyleSources {
  readonly customThemes: Root;
  readonly globals: Root;
}

/** Filesystem paths for the two stylesheets that own theme profiles. */
export interface ThemeStyleSourcePaths {
  readonly customThemes: string;
  readonly globals: string;
}

/** Expected failure while reading or parsing a theme-owning stylesheet. */
export class ThemeStyleSourceLoadError extends Schema.TaggedError<ThemeStyleSourceLoadError>()(
  "ThemeStyleSourceLoadError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
    path: Schema.String,
  }
) {}

const SIMPLE_THEME_SELECTOR_PATTERN = /^\.([a-z0-9-]+)$/;
const DEFAULT_THEME_STYLE_SOURCE_PATHS: ThemeStyleSourcePaths = {
  customThemes: fileURLToPath(new URL("../styles/theme.css", import.meta.url)),
  globals: fileURLToPath(new URL("../styles/globals.css", import.meta.url)),
};

function sourceLoadError(path: string, cause: unknown) {
  return new ThemeStyleSourceLoadError({
    cause,
    message: `Failed to load theme stylesheet at ${path}.`,
    path,
  });
}

/** Parses one stylesheet while preserving syntax failures in the typed channel. */
export const parseThemeStylesheet = Effect.fn(
  "designSystem.theme.parseStylesheet"
)((source: string, path: string) =>
  Effect.try({
    try: () => postcss.parse(source, { from: path }),
    catch: (cause) => sourceLoadError(path, cause),
  })
);

/** Reads and parses one stylesheet through the Effect Platform filesystem. */
const readStylesheet = Effect.fn("designSystem.theme.readStylesheet")(
  function* (path: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    const source = yield* fileSystem
      .readFileString(path, "utf8")
      .pipe(Effect.mapError((cause) => sourceLoadError(path, cause)));

    return yield* parseThemeStylesheet(source, path);
  }
);

/** Parses the two theme-owning stylesheets without running Tailwind. */
export const readThemeStyleSources = Effect.fn(
  "designSystem.theme.readStyleSources"
)(function* (paths: ThemeStyleSourcePaths = DEFAULT_THEME_STYLE_SOURCE_PATHS) {
  const customThemes = yield* readStylesheet(paths.customThemes);
  const globals = yield* readStylesheet(paths.globals);

  return { customThemes, globals } satisfies ThemeStyleSources;
});

/** Maps registry values to their concrete CSS selector owners. */
export function createThemeProfiles(
  names: readonly string[],
  sources: ThemeStyleSources
) {
  return names.map((name): ProfileSource => {
    if (name === "light") {
      return { name, root: sources.globals, selector: ":root" };
    }
    if (name === "dark") {
      return { name, root: sources.globals, selector: ".dark" };
    }
    return { name, root: sources.customThemes, selector: `.${name}` };
  });
}

/** Returns a profile rule only when declared at the stylesheet root. */
export function findTopLevelRule(
  root: Root,
  selector: string
): Rule | undefined {
  for (const node of root.nodes) {
    if (node.type === "rule" && node.selector === selector) {
      return node;
    }
  }
}

/** Returns the Tailwind inline-theme block from the global stylesheet. */
export function findInlineTheme(root: Root): AtRule | undefined {
  for (const node of root.nodes) {
    if (
      node.type === "atrule" &&
      node.name === "theme" &&
      node.params === "inline"
    ) {
      return node;
    }
  }
}

/** Reads a directly owned custom property without following inheritance. */
export function readDirectValue(container: Rule | AtRule, property: string) {
  for (const node of container.nodes ?? []) {
    if (node.type === "decl" && node.prop === property) {
      return node.value.trim();
    }
  }
}

/** Lists the simple top-level class selectors that own theme profiles. */
export function readCustomThemeNames(root: Root) {
  return root.nodes.flatMap((node) => {
    if (node.type !== "rule") {
      return [];
    }

    const name = SIMPLE_THEME_SELECTOR_PATTERN.exec(node.selector)?.[1];
    return name ? [name] : [];
  });
}

/** Calculates a full-precision WCAG 2.1 ratio through Color.js. */
export function getWcagContrast(color: string, against: string) {
  return Color.contrastWCAG21(new Color(against), new Color(color));
}

/** Projects canonical OKLCH into the required comma-form 8-bit sRGB value. */
export function toRgbProjection(value: string) {
  const channels = new Color(value)
    .to("srgb")
    .coords.map((channel) => Math.round(channel * 255));

  return `rgb(${channels.join(", ")})`;
}
