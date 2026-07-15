import { fileURLToPath } from "node:url";
import { FileSystem } from "@effect/platform";
import { TEXT_ROLE_PAIRS } from "@repo/design-system/lib/theme/contrast";
import Color from "colorjs.io";
import { Effect, Schema } from "effect";
import postcss, { type AtRule, type Root, type Rule } from "postcss";

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
  customThemes: fileURLToPath(
    new URL("../../styles/theme.css", import.meta.url)
  ),
  globals: fileURLToPath(new URL("../../styles/globals.css", import.meta.url)),
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

/** Projects canonical OKLCH into the required comma-form 8-bit sRGB value. */
export function toRgbProjection(value: string) {
  const channels = new Color(value)
    .to("srgb")
    .coords.map((channel) => Math.round(channel * 255));

  return `rgb(${channels.join(", ")})`;
}
