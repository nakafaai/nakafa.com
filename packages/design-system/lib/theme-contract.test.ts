// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import { themes } from "@repo/design-system/lib/theme";
import Color from "colorjs.io";
import { Effect } from "effect";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import {
  createThemeProfiles,
  findInlineTheme,
  findTopLevelRule,
  getWcagContrast,
  NON_TEXT_ROLE_PAIRS,
  parseThemeStylesheet,
  REQUIRED_THEME_TOKENS,
  readCustomThemeNames,
  readDirectValue,
  readThemeStyleSources,
  SEMANTIC_COLOR_TOKENS,
  STANDALONE_TEXT_ROLE_PAIRS,
  TEXT_ROLE_PAIRS,
  THEME_METADATA_TOKENS,
  ThemeStyleSourceLoadError,
} from "./theme-contract";

const STATUS_NAMES = ["success", "warning", "info"];
const NORMAL_TEXT_MINIMUM_CONTRAST = 4.5;
const NON_TEXT_MINIMUM_CONTRAST = 3;
const EXPECTED_CONCRETE_THEME_COUNT = 31;
const OKLCH_SYNTAX_PATTERN = /^oklch\(.+\)$/;
interface ContrastPair {
  readonly against: string;
  readonly color: string;
  readonly minimum: number;
  readonly role: string;
}

interface ThemeColorViolation {
  readonly profile: string;
  readonly reason: string;
  readonly token: string;
  readonly value?: string;
}

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
const textPairs = TEXT_ROLE_PAIRS.map(
  ([foreground, surface]): ContrastPair => ({
    against: `--${surface}`,
    color: `--${foreground}`,
    minimum: NORMAL_TEXT_MINIMUM_CONTRAST,
    role: "normal text on its declared semantic surface",
  })
);
for (const [color, against, role] of STANDALONE_TEXT_ROLE_PAIRS) {
  textPairs.push({
    against: `--${against}`,
    color: `--${color}`,
    minimum: NORMAL_TEXT_MINIMUM_CONTRAST,
    role,
  });
}
const nonTextPairs = NON_TEXT_ROLE_PAIRS.map(
  ([color, against, role]): ContrastPair => ({
    against: `--${against}`,
    color: `--${color}`,
    minimum: NON_TEXT_MINIMUM_CONTRAST,
    role,
  })
);

/** Collects every failure so reports preserve full-precision ratios. */
function findContrastViolations(pairs: readonly ContrastPair[]) {
  return profiles.flatMap((profile) => {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      return [];
    }

    return pairs.flatMap((pair) => {
      const color = readDirectValue(rule, pair.color);
      const against = readDirectValue(rule, pair.against);
      if (!(color && against)) {
        return [];
      }

      const ratio = getWcagContrast(color, against);
      return ratio < pair.minimum
        ? [{ ...pair, profile: profile.name, ratio }]
        : [];
    });
  });
}

/** Reports all invalid authored colors instead of stopping at the first. */
function findThemeColorViolations() {
  const violations: ThemeColorViolation[] = [];

  for (const profile of profiles) {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      continue;
    }

    for (const token of SEMANTIC_COLOR_TOKENS) {
      const value = readDirectValue(rule, token);
      if (!value) {
        violations.push({ profile: profile.name, reason: "missing", token });
        continue;
      }
      if (!OKLCH_SYNTAX_PATTERN.test(value)) {
        violations.push({
          profile: profile.name,
          reason: "not OKLCH",
          token,
          value,
        });
        continue;
      }

      const color = new Color(value);
      if (color.alpha !== 1) {
        violations.push({
          profile: profile.name,
          reason: "not opaque",
          token,
          value,
        });
      }
      if (!color.inGamut("srgb")) {
        violations.push({
          profile: profile.name,
          reason: "outside sRGB",
          token,
          value,
        });
      }
    }
  }

  return violations;
}

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
          THEME_METADATA_TOKENS.includes(property)
        )
    );

    expect(coreProperties.sort()).toEqual([...REQUIRED_THEME_TOKENS].sort());
    expect(unexpectedProperties).toEqual([]);
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

describe("theme color quality", () => {
  it("authors every semantic color as opaque, sRGB-gamut OKLCH", () => {
    expect(findThemeColorViolations()).toEqual([]);
  });

  it("meets 4.5:1 for every normal-text pair without rounding", () => {
    expect(findContrastViolations(textPairs)).toEqual([]);
  });

  it("meets 3:1 for opaque focus and control roles without rounding", () => {
    expect(findContrastViolations(nonTextPairs)).toEqual([]);
  });
});
