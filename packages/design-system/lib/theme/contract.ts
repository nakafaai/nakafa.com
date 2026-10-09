import { TEXT_ROLE_PAIRS } from "@repo/design-system/lib/theme/contrast";
import Color from "colorjs.io";
import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";
import postcss, { type AtRule, Root, type Rule } from "postcss";

/** Complete semantic color surface shared by every concrete profile. */
export const SEMANTIC_COLOR_TOKENS = [
  ...Arr.flatMap(TEXT_ROLE_PAIRS, ([foreground, surface]) => [
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

/** Allowed theme metadata; serif typography stays with the shared font token. */
export const THEME_METADATA_PROPERTIES = [
  "color-scheme",
  "--font-mono",
  "--font-sans",
  "--shadow-color",
];

const ProfileSourceSchema = Schema.Struct({
  name: Schema.String,
  root: Schema.instanceOf(Root),
  selector: Schema.String,
});
/** A concrete theme selector and the stylesheet that must directly own it. */
export type ProfileSource = typeof ProfileSourceSchema.Type;

const ThemeStyleSourcesSchema = Schema.Struct({
  customThemes: Schema.instanceOf(Root),
  globals: Schema.instanceOf(Root),
});
/** Parsed owners for the official pair and selectable named profiles. */
type ThemeStyleSources = typeof ThemeStyleSourcesSchema.Type;

const ThemeStyleSourcePathsSchema = Schema.Struct({
  customThemes: Schema.String,
  globals: Schema.String,
});
/** Filesystem paths for the two stylesheets that own theme profiles. */
type ThemeStyleSourcePaths = typeof ThemeStyleSourcePathsSchema.Type;

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

/** Builds one typed stylesheet read failure with its exact source path. */
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

/** Resolves the two theme-owning stylesheets that sit beside this module. */
const defaultThemeStyleSourcePaths = Effect.fn(
  "designSystem.theme.defaultStyleSourcePaths"
)(function* () {
  const path = yield* Path.Path;
  // This module's own file URLs always convert, so a failure stays a defect.
  const customThemes = yield* path
    .fromFileUrl(new URL("../../styles/theme.css", import.meta.url))
    .pipe(Effect.orDie);
  const globals = yield* path
    .fromFileUrl(new URL("../../styles/globals.css", import.meta.url))
    .pipe(Effect.orDie);

  return { customThemes, globals } satisfies ThemeStyleSourcePaths;
});

/** Parses the two theme-owning stylesheets without running Tailwind. */
export const readThemeStyleSources = Effect.fn(
  "designSystem.theme.readStyleSources"
)(function* (paths?: ThemeStyleSourcePaths) {
  const sourcePaths = paths ?? (yield* defaultThemeStyleSourcePaths());
  const customThemes = yield* readStylesheet(sourcePaths.customThemes);
  const globals = yield* readStylesheet(sourcePaths.globals);

  return { customThemes, globals } satisfies ThemeStyleSources;
});

/** Maps registry values to their concrete CSS selector owners. */
export function createThemeProfiles(
  names: readonly string[],
  sources: ThemeStyleSources
) {
  return Arr.map(names, (name): ProfileSource => {
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
  return Arr.flatMap(root.nodes, (node) => {
    if (node.type !== "rule") {
      return [];
    }

    const name = SIMPLE_THEME_SELECTOR_PATTERN.exec(node.selector)?.[1];
    return name ? [name] : [];
  });
}

/** Expected failure: a theme color has no numeric value for one channel. */
export class ThemeColorChannelError extends Schema.TaggedError<ThemeColorChannelError>()(
  "ThemeColorChannelError",
  {
    message: Schema.String,
    value: Schema.String,
  }
) {}

/** Requires one complete color channel before numeric theme calculations. */
function requireColorChannel(
  channel: null | number,
  value: string
): Effect.Effect<number, ThemeColorChannelError> {
  if (channel === null) {
    return Effect.fail(
      new ThemeColorChannelError({
        message: `Theme color "${value}" has a missing channel.`,
        value,
      })
    );
  }

  return Effect.succeed(channel);
}

/** Reads complete OKLCH channels from one canonical theme color. */
export const readOklchChannels = Effect.fn(
  "designSystem.theme.readOklchChannels"
)(function* (value: string) {
  const [lightness, chroma, hue] = new Color(value).oklch;

  return yield* Effect.all({
    chroma: requireColorChannel(chroma, value),
    hue: requireColorChannel(hue, value),
    lightness: requireColorChannel(lightness, value),
  });
});

/** Projects canonical OKLCH into the required comma-form 8-bit sRGB value. */
export const toRgbProjection = Effect.fn("designSystem.theme.toRgbProjection")(
  function* (value: string) {
    const channels = yield* Effect.forEach(
      new Color(value).to("srgb").coords,
      (channel) =>
        requireColorChannel(channel, value).pipe(
          Effect.map((byte) => String(Math.round(byte * 255)))
        )
    );

    return `rgb(${Arr.join(channels, ", ")})`;
  }
);
