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
} from "@repo/design-system/test/contract";
import { Array as Arr, Effect, Option, Order, Record as Rec } from "effect";

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
      const profile = Arr.findFirst(
        profiles,
        (candidate) => candidate.name === name
      );
      expect(Option.isSome(profile)).toBe(true);
      if (Option.isNone(profile)) {
        return;
      }

      const rule = findTopLevelRule(profile.value.root, profile.value.selector);
      expect(rule).toBeDefined();
      if (!rule) {
        return;
      }

      const expected = Rec.fromEntries(
        yield* Effect.forEach(SEMANTIC_COLOR_TOKENS, (token) =>
          Effect.gen(function* () {
            const value = readDirectValue(rule, token);
            expect(value).toBeDefined();
            return [
              token.slice(2),
              value ? yield* toRgbProjection(value) : undefined,
            ] as const;
          })
        )
      );

      expect(Arr.sort(Rec.keys(values), Order.String)).toEqual(
        Arr.sort(
          Arr.map(SEMANTIC_COLOR_TOKENS, (token) => token.slice(2)),
          Order.String
        )
      );
      expect(values).toEqual(expected);
    })
  );
});
