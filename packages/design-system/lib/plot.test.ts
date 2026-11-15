// @vitest-environment node

import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  AXIS_COLORS,
  PLOT_COLORS,
  PlotColorSchema,
} from "@repo/design-system/lib/plot";
import {
  createThemeProfiles,
  findTopLevelRule,
  readDirectValue,
  readThemeStyleSources,
} from "@repo/design-system/test/contract";
import { getWcagContrast } from "@repo/design-system/test/contrast";
import Color from "colorjs.io";
import { Array as Arr, Effect, Record as Rec } from "effect";

const MINIMUM_AXIS_DISTANCE = 30;
const MINIMUM_PAIR_DISTANCE = 0.09;
const MINIMUM_SURFACE_CONTRAST = 3;
// Below this chroma a color reads as gray, so it has no hue to confuse.
const NEUTRAL_CHROMA = 0.05;
const APPEARANCES = ["light", "dark"] as const;

/** Reads the OKLCH lightness, chroma, and hue of one color. */
function oklch(color: string) {
  const [lightness, chroma, hue] = new Color(color).to("oklch").coords;
  return { chroma: chroma ?? 0, hue: hue ?? 0, lightness: lightness ?? 0 };
}

/** The shorter way around the hue circle between two hues, in degrees. */
function hueDistance(left: number, right: number) {
  const difference = Math.abs(left - right) % 360;
  return Math.min(difference, 360 - difference);
}

const axisHues = Arr.map(Rec.values(AXIS_COLORS), (axis) => oklch(axis).hue);

describe("plot palette", () => {
  it("keeps every plot hue away from the axes", () => {
    const nearAxes = Arr.flatMap(PlotColorSchema.literals, (name) => {
      const { chroma, hue } = oklch(PLOT_COLORS[name]);
      const nearest = Math.min(
        ...Arr.map(axisHues, (axis) => hueDistance(hue, axis))
      );
      return chroma >= NEUTRAL_CHROMA && nearest < MINIMUM_AXIS_DISTANCE
        ? [{ name, nearest }]
        : [];
    });

    expect(nearAxes).toStrictEqual([]);
  });

  it("tells every two plot colors apart", () => {
    const pairs = Arr.flatMap(PlotColorSchema.literals, (left, index) =>
      Arr.map(Arr.drop(PlotColorSchema.literals, index + 1), (right) => ({
        distance: new Color(PLOT_COLORS[left]).deltaE(
          new Color(PLOT_COLORS[right]),
          "OK"
        ),
        pair: `${left} ${right}`,
      }))
    );

    expect(
      Arr.filter(pairs, ({ distance }) => distance < MINIMUM_PAIR_DISTANCE)
    ).toStrictEqual([]);
  });

  it.effect("reads at 3:1 on Nakafa's light and dark card", () =>
    Effect.gen(function* () {
      const profiles = createThemeProfiles(
        APPEARANCES,
        yield* readThemeStyleSources()
      );
      const faint = Arr.flatMap(APPEARANCES, (mode, index) => {
        const profile = profiles[index];
        const rule =
          profile && findTopLevelRule(profile.root, profile.selector);
        const card = rule && readDirectValue(rule, "--card");
        if (!card) {
          return [{ mode, name: "card", ratio: 0 }];
        }
        return Arr.flatMap(PlotColorSchema.literals, (name) => {
          const ratio = getWcagContrast(PLOT_COLORS[name], card);
          return ratio < MINIMUM_SURFACE_CONTRAST
            ? [{ mode, name, ratio }]
            : [];
        });
      });

      expect(faint).toStrictEqual([]);
    }).pipe(Effect.provide(NodeFileSystem.layer))
  );
});
