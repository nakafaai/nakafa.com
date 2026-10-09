// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  createThemeProfiles,
  findTopLevelRule,
  type ProfileSource,
  readDirectValue,
  readOklchChannels,
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
import {
  Array as Arr,
  Effect,
  HashSet,
  MutableList,
  Record as Rec,
  Schema,
} from "effect";

const NORMAL_TEXT_MINIMUM_CONTRAST = 4.5;
const NON_TEXT_MINIMUM_CONTRAST = 3;
const MINIMUM_BOUNDARY_CONTRAST = 1.15;
const MINIMUM_BORDER_INPUT_DISTANCE = 0.019;
const MAXIMUM_BORDER_INPUT_DISTANCE = 0.025;
const MAXIMUM_FAMILY_CHROMA_DIFFERENCE = 0.0001;
const MAXIMUM_FAMILY_HUE_DIFFERENCE = 0.01;
// These graphic themes intentionally use one high-contrast outline ink for
// both structural boundaries and controls.
const UNIFIED_OUTLINE_PROFILES = HashSet.make("neo", "popsicle", "shell");
const OKLCH_SYNTAX_PATTERN = /^oklch\(.+\)$/;
const PERCEPTIBLE_BOUNDARY_PAIRS = [
  ["--border", "--background"],
  ["--border", "--card"],
  ["--border", "--popover"],
  ["--sidebar-border", "--sidebar"],
] as const;
const ContrastPairSchema = Schema.Struct({
  against: Schema.String,
  color: Schema.String,
  minimum: Schema.Finite,
  role: Schema.String,
});
type ContrastPair = typeof ContrastPairSchema.Type;

const ThemeColorViolationSchema = Schema.Struct({
  profile: Schema.String,
  reason: Schema.String,
  token: Schema.String,
  value: Schema.optionalKey(Schema.String),
});
type ThemeColorViolation = typeof ThemeColorViolationSchema.Type;

const ThemeCohesionViolationSchema = Schema.Struct({
  profile: Schema.String,
  reason: Schema.String,
  tokens: Schema.Array(Schema.String),
});
type ThemeCohesionViolation = typeof ThemeCohesionViolationSchema.Type;

const concreteThemeNames = Arr.flatMap(themes, (theme) =>
  theme.appearance === "dynamic" ? [] : [theme.value]
);
const readProfiles = readThemeStyleSources().pipe(
  Effect.map((sources) => createThemeProfiles(concreteThemeNames, sources)),
  Effect.provide(NodeFileSystem.layer)
);
const textPairs = Arr.appendAll(
  Arr.map(
    TEXT_ROLE_PAIRS,
    ([foreground, surface]): ContrastPair => ({
      against: `--${surface}`,
      color: `--${foreground}`,
      minimum: NORMAL_TEXT_MINIMUM_CONTRAST,
      role: "normal text on its declared semantic surface",
    })
  ),
  Arr.map(
    STANDALONE_TEXT_ROLE_PAIRS,
    ([color, against, role]): ContrastPair => ({
      against: `--${against}`,
      color: `--${color}`,
      minimum: NORMAL_TEXT_MINIMUM_CONTRAST,
      role,
    })
  )
);

const nonTextPairs = Arr.map(
  NON_TEXT_ROLE_PAIRS,
  ([color, against, role]): ContrastPair => ({
    against: `--${against}`,
    color: `--${color}`,
    minimum: NON_TEXT_MINIMUM_CONTRAST,
    role,
  })
);

/** Finds text or non-text semantic tokens below their contrast requirement. */
function findContrastViolations(
  profiles: readonly ProfileSource[],
  pairs: readonly ContrastPair[]
) {
  return Arr.flatMap(profiles, (profile) => {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      return [];
    }

    return Arr.flatMap(pairs, (pair) => {
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

/** Finds missing, invalid, translucent, or out-of-gamut semantic colors. */
function findThemeColorViolations(profiles: readonly ProfileSource[]) {
  const violations = MutableList.make<ThemeColorViolation>();

  for (const profile of profiles) {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      continue;
    }

    for (const token of SEMANTIC_COLOR_TOKENS) {
      const value = readDirectValue(rule, token);
      if (!value) {
        MutableList.append(violations, {
          profile: profile.name,
          reason: "missing",
          token,
        });
        continue;
      }
      if (!OKLCH_SYNTAX_PATTERN.test(value)) {
        MutableList.append(violations, {
          profile: profile.name,
          reason: "not OKLCH",
          token,
          value,
        });
        continue;
      }

      const color = new Color(value);
      if (color.alpha !== 1) {
        MutableList.append(violations, {
          profile: profile.name,
          reason: "not opaque",
          token,
          value,
        });
      }
      if (!color.inGamut("srgb")) {
        MutableList.append(violations, {
          profile: profile.name,
          reason: "outside sRGB",
          token,
          value,
        });
      }
    }
  }

  return MutableList.toArray(violations);
}

/** Returns the shortest angular distance between two hue values. */
function getHueDistance(first: number, second: number) {
  return Math.abs(((first - second + 540) % 360) - 180);
}

/** Finds border and input colors that no longer form one visual family. */
const findBorderInputFamilyViolations = Effect.fn(
  "theme.contrast.findBorderInputFamilyViolations"
)(function* (profiles: readonly ProfileSource[]) {
  const violations = MutableList.make<ThemeCohesionViolation>();

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

    const { chroma: borderChroma, hue: borderHue } =
      yield* readOklchChannels(border);
    const { chroma: inputChroma, hue: inputHue } =
      yield* readOklchChannels(input);
    const perceptualDistance = new Color(border).deltaE(new Color(input), "OK");
    const chromaDifference = Math.abs(borderChroma - inputChroma);
    const hueDifference = getHueDistance(borderHue, inputHue);
    const usesUnifiedOutline =
      perceptualDistance < MINIMUM_BORDER_INPUT_DISTANCE;
    const intentionallyUnified = HashSet.has(
      UNIFIED_OUTLINE_PROFILES,
      profile.name
    );
    const inputContrast = getWcagContrast(input, background);
    const borderContrast = getWcagContrast(border, background);

    if (
      chromaDifference > MAXIMUM_FAMILY_CHROMA_DIFFERENCE ||
      hueDifference > MAXIMUM_FAMILY_HUE_DIFFERENCE ||
      perceptualDistance > MAXIMUM_BORDER_INPUT_DISTANCE ||
      usesUnifiedOutline !== intentionallyUnified ||
      (!intentionallyUnified && inputContrast <= borderContrast)
    ) {
      MutableList.append(violations, {
        profile: profile.name,
        reason: "border and input lose their subtle shared hierarchy",
        tokens: ["--border", "--input"],
      });
    }
  }

  return MutableList.toArray(violations);
});

/** Finds semantic borders that disappear against their owning surfaces. */
function findErasedBoundaries(profiles: readonly ProfileSource[]) {
  const violations = MutableList.make<ThemeCohesionViolation>();

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
        MutableList.append(violations, {
          profile: profile.name,
          reason: "boundary lacks sufficient local contrast",
          tokens: [borderToken, surfaceToken],
        });
      }
    }
  }

  return MutableList.toArray(violations);
}

/** Finds status colors outside their declared chroma and hue families. */
const findStatusColorFamilyViolations = Effect.fn(
  "theme.contrast.findStatusColorFamilyViolations"
)(function* (profiles: readonly ProfileSource[]) {
  const violations = MutableList.make<ThemeCohesionViolation>();

  for (const profile of profiles) {
    const rule = findTopLevelRule(profile.root, profile.selector);
    if (!rule) {
      continue;
    }

    for (const [status, family] of Rec.toEntries(STATUS_COLOR_FAMILIES)) {
      const token = `--${status}`;
      const value = readDirectValue(rule, token);
      if (!value) {
        continue;
      }

      const { chroma, hue } = yield* readOklchChannels(value);
      if (
        chroma < family.minimumChroma ||
        hue < family.minimumHue ||
        hue > family.maximumHue
      ) {
        MutableList.append(violations, {
          profile: profile.name,
          reason: `${status} leaves its familiar semantic color family`,
          tokens: [token],
        });
      }
    }
  }

  return MutableList.toArray(violations);
});

describe("theme color quality", () => {
  it.effect("authors every semantic color as opaque, sRGB-gamut OKLCH", () =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      expect(findThemeColorViolations(profiles)).toEqual([]);
    })
  );

  it.effect("meets 4.5:1 for every normal-text pair without rounding", () =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      expect(findContrastViolations(profiles, textPairs)).toEqual([]);
    })
  );

  it.effect("meets 3:1 for opaque focus and chart roles without rounding", () =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      expect(findContrastViolations(profiles, nonTextPairs)).toEqual([]);
    })
  );

  it.effect(
    "keeps structural and control borders in one local color family",
    () =>
      Effect.gen(function* () {
        const profiles = yield* readProfiles;
        expect(yield* findBorderInputFamilyViolations(profiles)).toEqual([]);
      })
  );

  it.effect("keeps structural and sidebar boundaries perceptible", () =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      expect(findErasedBoundaries(profiles)).toEqual([]);
    })
  );

  it.effect("keeps status roles inside familiar semantic hue families", () =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      expect(yield* findStatusColorFamilyViolations(profiles)).toEqual([]);
    })
  );
});
