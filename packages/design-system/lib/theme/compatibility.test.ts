// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import {
  createThemeProfiles,
  findTopLevelRule,
  readDirectValue,
  readThemeStyleSources,
  SEMANTIC_COLOR_TOKENS,
  toRgbProjection,
} from "@repo/design-system/lib/theme/contract";
import { Effect } from "effect";

const readProfiles = readThemeStyleSources().pipe(
  Effect.map((sources) => createThemeProfiles(["light", "dark"], sources)),
  Effect.provide(NodeFileSystem.layer)
);

describe("theme compatibility colors", () => {
  it.effect.each([
    { name: "light", values: THEME_COMPATIBILITY_COLORS.light },
    { name: "dark", values: THEME_COMPATIBILITY_COLORS.dark },
  ])("derives every $name RGB value from canonical OKLCH", ({ name, values }) =>
    Effect.gen(function* () {
      const profiles = yield* readProfiles;
      const profile = profiles.find((candidate) => candidate.name === name);
      expect(profile).toBeDefined();
      if (!profile) {
        return;
      }

      const rule = findTopLevelRule(profile.root, profile.selector);
      expect(rule).toBeDefined();
      if (!rule) {
        return;
      }

      const expected = Object.fromEntries(
        SEMANTIC_COLOR_TOKENS.map((token) => {
          const value = readDirectValue(rule, token);
          expect(value).toBeDefined();
          return [token.slice(2), value ? toRgbProjection(value) : undefined];
        })
      );

      expect(Object.keys(values).sort()).toEqual(
        SEMANTIC_COLOR_TOKENS.map((token) => token.slice(2)).sort()
      );
      expect(values).toEqual(expected);
    })
  );
});
