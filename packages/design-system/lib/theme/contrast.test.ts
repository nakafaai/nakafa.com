// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import {
  createThemeProfiles,
  findTopLevelRule,
  readDirectValue,
  readThemeStyleSources,
  SEMANTIC_COLOR_TOKENS,
} from "@repo/design-system/lib/theme/contract";
import {
  getWcagContrast,
  NON_TEXT_ROLE_PAIRS,
  STANDALONE_TEXT_ROLE_PAIRS,
  STATUS_COLOR_FAMILIES,
  TEXT_ROLE_PAIRS,
} from "@repo/design-system/lib/theme/contrast";
import { themes } from "@repo/design-system/lib/theme/registry";
import Color from "colorjs.io";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const NORMAL_TEXT_MINIMUM_CONTRAST = 4.5;
const NON_TEXT_MINIMUM_CONTRAST = 3;
const MINIMUM_BOUNDARY_CONTRAST = 1.15;
const MINIMUM_BORDER_INPUT_DISTANCE = 0.019;
const MAXIMUM_BORDER_INPUT_DISTANCE = 0.025;
const MAXIMUM_FAMILY_CHROMA_DIFFERENCE = 0.0001;
const MAXIMUM_FAMILY_HUE_DIFFERENCE = 0.01;
// These graphic themes intentionally use one high-contrast outline ink for
// both structural boundaries and controls.
const UNIFIED_OUTLINE_PROFILES = new Set(["neo", "popsicle", "shell"]);
const OKLCH_SYNTAX_PATTERN = /^oklch\(.+\)$/;
const PERCEPTIBLE_BOUNDARY_PAIRS = [
  ["--border", "--background"],
  ["--border", "--card"],
  ["--border", "--popover"],
  ["--sidebar-border", "--sidebar"],
] as const;
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

interface ThemeCohesionViolation {
  readonly profile: string;
  readonly reason: string;
  readonly tokens: readonly string[];
}

const sources = await Effect.runPromise(
  readThemeStyleSources().pipe(Effect.provide(NodeFileSystem.layer))
);
const concreteThemeNames = themes.flatMap((theme) =>
  theme.appearance === "dynamic" ? [] : [theme.value]
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

function getHueDistance(first: number, second: number) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

function findBorderInputFamilyViolations() {
  const violations: ThemeCohesionViolation[] = [];

  for (const profile of profiles) {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      continue;
    }

    const border = readDirectValue(rule, "--border");
    const input = readDirectValue(rule, "--input");
    const background = readDirectValue(rule, "--background");
    if (!(border && input && background)) {
      continue;
    }

    const [, borderChroma, borderHue] = new Color(border).oklch;
    const [, inputChroma, inputHue] = new Color(input).oklch;
    const perceptualDistance = new Color(border).deltaE(new Color(input), "OK");
    const chromaDifference = Math.abs(borderChroma - inputChroma);
    const hueDifference = getHueDistance(borderHue, inputHue);
    const usesUnifiedOutline =
      perceptualDistance < MINIMUM_BORDER_INPUT_DISTANCE;
    const intentionallyUnified = UNIFIED_OUTLINE_PROFILES.has(profile.name);
    const inputContrast = getWcagContrast(input, background);
    const borderContrast = getWcagContrast(border, background);

    if (
      chromaDifference > MAXIMUM_FAMILY_CHROMA_DIFFERENCE ||
      hueDifference > MAXIMUM_FAMILY_HUE_DIFFERENCE ||
      perceptualDistance > MAXIMUM_BORDER_INPUT_DISTANCE ||
      usesUnifiedOutline !== intentionallyUnified ||
      (!intentionallyUnified && inputContrast <= borderContrast)
    ) {
      violations.push({
        profile: profile.name,
        reason: "border and input lose their subtle shared hierarchy",
        tokens: ["--border", "--input"],
      });
    }
  }

  return violations;
}

function findErasedBoundaries() {
  const violations: ThemeCohesionViolation[] = [];

  for (const profile of profiles) {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      continue;
    }

    for (const [borderToken, surfaceToken] of PERCEPTIBLE_BOUNDARY_PAIRS) {
      const border = readDirectValue(rule, borderToken);
      const surface = readDirectValue(rule, surfaceToken);
      if (!(border && surface)) {
        continue;
      }

      const contrast = getWcagContrast(border, surface);
      if (contrast < MINIMUM_BOUNDARY_CONTRAST) {
        violations.push({
          profile: profile.name,
          reason: "boundary lacks sufficient local contrast",
          tokens: [borderToken, surfaceToken],
        });
      }
    }
  }

  return violations;
}

function findStatusColorFamilyViolations() {
  const violations: ThemeCohesionViolation[] = [];

  for (const profile of profiles) {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      continue;
    }

    for (const [status, family] of Object.entries(STATUS_COLOR_FAMILIES)) {
      const token = `--${status}`;
      const value = readDirectValue(rule, token);
      if (!value) {
        continue;
      }

      const [, chroma, hue] = new Color(value).oklch;
      if (
        chroma < family.minimumChroma ||
        hue < family.minimumHue ||
        hue > family.maximumHue
      ) {
        violations.push({
          profile: profile.name,
          reason: `${status} leaves its familiar semantic color family`,
          tokens: [token],
        });
      }
    }
  }

  return violations;
}

describe("theme color quality", () => {
  it("authors every semantic color as opaque, sRGB-gamut OKLCH", () => {
    expect(findThemeColorViolations()).toEqual([]);
  });

  it("meets 4.5:1 for every normal-text pair without rounding", () => {
    expect(findContrastViolations(textPairs)).toEqual([]);
  });

  it("meets 3:1 for opaque focus and chart roles without rounding", () => {
    expect(findContrastViolations(nonTextPairs)).toEqual([]);
  });

  it("keeps structural and control borders in one local color family", () => {
    expect(findBorderInputFamilyViolations()).toEqual([]);
  });

  it("keeps structural and sidebar boundaries perceptible", () => {
    expect(findErasedBoundaries()).toEqual([]);
  });

  it("keeps status roles inside familiar semantic hue families", () => {
    expect(findStatusColorFamilyViolations()).toEqual([]);
  });
});
