// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import {
  createThemeProfiles,
  findInlineTheme,
  findTopLevelRule,
  parseThemeStylesheet,
  REQUIRED_THEME_TOKENS,
  readCustomThemeNames,
  readDirectValue,
  readThemeStyleSources,
  SEMANTIC_COLOR_TOKENS,
  THEME_METADATA_PROPERTIES,
  ThemeStyleSourceLoadError,
} from "@repo/design-system/lib/theme/contract";
import { themes } from "@repo/design-system/lib/theme/registry";
import { Effect } from "effect";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const STATUS_NAMES = ["success", "warning", "info"];
const THEME_IDENTITY_TOKENS = [
  "--primary",
  "--secondary",
  "--accent",
  "--ring",
  "--success",
  "--warning",
  "--info",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;
const EXPECTED_CONCRETE_THEME_COUNT = 31;

const sources = await Effect.runPromise(
  readThemeStyleSources().pipe(Effect.provide(NodeFileSystem.layer))
);
const registeredThemeNames = themes.map((theme) => theme.value);
const concreteThemeNames = registeredThemeNames.filter(
  (name) => name !== "system"
);
const customThemeNames = concreteThemeNames.filter(
  (name) => name !== "light" && name !== "dark"
);
const profiles = createThemeProfiles(concreteThemeNames, sources);

describe("theme profile contract", () => {
  it("returns a typed failure when a theme stylesheet cannot load", async () => {
    const missingPath = "/theme-contract/intentionally-missing.css";
    const result = await Effect.runPromise(
      Effect.either(
        readThemeStyleSources({
          customThemes: missingPath,
          globals: missingPath,
        }).pipe(Effect.provide(NodeFileSystem.layer))
      )
    );

    expect(result._tag).toBe("Left");
    if (result._tag !== "Left") {
      return;
    }

    expect(result.left).toBeInstanceOf(ThemeStyleSourceLoadError);
    expect(result.left).toMatchObject({
      _tag: "ThemeStyleSourceLoadError",
      message: `Failed to load theme stylesheet at ${missingPath}.`,
      path: missingPath,
    });
  });

  it("returns a typed failure when a theme stylesheet cannot parse", () => {
    const path = "/theme-contract/invalid.css";
    const result = Effect.runSync(
      Effect.either(parseThemeStylesheet("}", path))
    );

    expect(result._tag).toBe("Left");
    if (result._tag !== "Left") {
      return;
    }
    expect(result.left).toMatchObject({ path });
  });

  it("inspects only direct declarations and simple top-level selectors", () => {
    const syntheticRoot = postcss.parse(`
      @layer base {}
      .valid { --value: oklch(0.5 0.1 240); }
      .complex:hover { --value: oklch(0.5 0.1 240); }
    `);
    const validRule = findTopLevelRule(syntheticRoot, ".valid");

    expect(findTopLevelRule(syntheticRoot, ".missing")).toBeUndefined();
    expect(findInlineTheme(syntheticRoot)).toBeUndefined();
    expect(readCustomThemeNames(syntheticRoot)).toEqual(["valid"]);
    expect(validRule).toBeDefined();
    if (!validRule) {
      return;
    }

    expect(readDirectValue(validRule, "--value")).toBe("oklch(0.5 0.1 240)");
    expect(readDirectValue(validRule, "--missing")).toBeUndefined();
    expect(
      readDirectValue(postcss.atRule({ name: "theme" }), "--missing")
    ).toBeUndefined();
  });

  it("defines the agreed 38-color and 47-declaration contracts", () => {
    expect(SEMANTIC_COLOR_TOKENS).toHaveLength(38);
    expect(new Set(SEMANTIC_COLOR_TOKENS).size).toBe(38);
    expect(REQUIRED_THEME_TOKENS).toHaveLength(47);
    expect(new Set(REQUIRED_THEME_TOKENS).size).toBe(47);
  });

  it("registers exactly 31 concrete profiles plus system preference", () => {
    expect(concreteThemeNames).toHaveLength(EXPECTED_CONCRETE_THEME_COUNT);
    expect(
      registeredThemeNames.filter((name) => name === "system")
    ).toHaveLength(1);
    expect(new Set(registeredThemeNames).size).toBe(themes.length);
  });

  it("keeps registry custom names synchronized with CSS selectors", () => {
    expect(readCustomThemeNames(sources.customThemes).sort()).toEqual(
      [...customThemeNames].sort()
    );
  });

  it("gives every concrete theme a distinct semantic identity", () => {
    const fingerprints = profiles.map((profile) => {
      const rule = findTopLevelRule(profile.root, profile.selector);
      expect(rule).toBeDefined();
      if (!rule) {
        return "";
      }

      return THEME_IDENTITY_TOKENS.map((token) =>
        readDirectValue(rule, token)
      ).join("|");
    });

    expect(new Set(fingerprints).size).toBe(profiles.length);
  });

  it("keeps each theme's feedback palette distinct", () => {
    const fingerprints = profiles.map((profile) => {
      const rule = findTopLevelRule(profile.root, profile.selector);
      expect(rule).toBeDefined();
      if (!rule) {
        return "";
      }

      return STATUS_NAMES.flatMap((status) => [
        readDirectValue(rule, `--${status}`),
        readDirectValue(rule, `--${status}-foreground`),
      ]).join("|");
    });

    expect(new Set(fingerprints).size).toBe(profiles.length);
  });

  it.each(profiles)("$name owns each required core token once", (profile) => {
    const rule = findTopLevelRule(profile.root, profile.selector);
    expect(
      rule,
      `${profile.name} must declare ${profile.selector}`
    ).toBeDefined();
    if (!rule) {
      return;
    }

    const properties = rule.nodes.flatMap((node) =>
      node.type === "decl" ? [node.prop] : []
    );
    const coreProperties = properties.filter((property) =>
      REQUIRED_THEME_TOKENS.includes(property)
    );
    const unexpectedProperties = properties.filter(
      (property) =>
        !(
          REQUIRED_THEME_TOKENS.includes(property) ||
          THEME_METADATA_PROPERTIES.includes(property)
        )
    );

    expect(coreProperties.sort()).toEqual([...REQUIRED_THEME_TOKENS].sort());
    expect(unexpectedProperties).toEqual([]);
  });

  it.each(profiles)("$name owns its concrete color scheme", (profile) => {
    const rule = findTopLevelRule(profile.root, profile.selector);
    expect(rule).toBeDefined();
    if (!rule) {
      return;
    }

    const definition = themes.find((theme) => theme.value === profile.name);
    expect(definition).toBeDefined();
    if (!definition) {
      return;
    }

    const colorSchemes = rule.nodes.flatMap((node) =>
      node.type === "decl" && node.prop === "color-scheme"
        ? [node.value.trim()]
        : []
    );
    expect(colorSchemes).toEqual([definition.appearance]);
  });

  it("maps every status pair into Tailwind's inline theme", () => {
    const inlineTheme = findInlineTheme(sources.globals);
    expect(inlineTheme).toBeDefined();
    if (!inlineTheme) {
      return;
    }

    for (const status of STATUS_NAMES) {
      expect(readDirectValue(inlineTheme, `--color-${status}`)).toBe(
        `var(--${status})`
      );
      expect(readDirectValue(inlineTheme, `--color-${status}-foreground`)).toBe(
        `var(--${status}-foreground)`
      );
    }
  });
});
