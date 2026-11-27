import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr, Match, Schema } from "effect";

/**
 * Laboratory glassware at its catalogue size. An author names a vessel and
 * its capacity, a 250 mL beaker or a 100 mL conical flask, and this module
 * knows the rest: the outline a glassblower turns, how thick its wall is,
 * the height at which it holds any volume, the body of the liquid in it with
 * the meniscus water draws up the glass, and the scale fired on its side,
 * each mark at the height the vessel really holds that volume. Every length
 * is in metres and every volume in millilitres.
 */

/** A vessel as an author names it: what it is and its nominal capacity, in millilitres. */
export const VesselSchema = Schema.Struct({
  capacity: Schema.Finite,
  kind: Schema.Literals(["beaker", "conical"]),
});
export type Vessel = typeof VesselSchema.Type;

/** One point of an outline: its radius from the axis, then its height. */
const OutlinePointSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type OutlinePoint = typeof OutlinePointSchema.Type;

/** A cubic metre in millilitres. */
const MILLILITRES = 1e6;

/**
 * The proportions of a low form beaker (ISO 3819): a 250 mL one is 70 mm
 * across and 95 mm tall, and the others are the same shape at their size.
 */
const BEAKER = { across: 0.0111, corner: 0.09, flare: 0.045, tall: 1.36 };

/**
 * The proportions of a narrow neck conical flask (ISO 1773): a 250 mL one
 * is 85 mm across its base and 140 mm tall, with a neck 34 mm across.
 */
const CONICAL = {
  across: 0.0135,
  bead: 0.035,
  corner: 0.1,
  neck: 0.4,
  tall: 1.65,
  throat: 0.2,
};

/** The wall's thickness as a share of the vessel's width: 1.8 mm on a 70 mm beaker. */
const WALL = 0.026;

/** How much thicker than its wall a vessel's base is. */
const BASE = 1.5;

/** How far the liquid stands off the glass, so the two never share a depth. */
const CLEARANCE = 0.000_15;

/** How high water climbs clean glass, and how far in from the wall its surface is flat again. */
const MENISCUS = { reach: 0.0046, rise: 0.0018, steps: 6 };

/** The marks of a vessel's scale: at every fifth of its capacity, from one fifth to four. */
const MARKS = [1, 2, 3, 4] as const;

/** The widths of a scale's parts, in heights of a number. */
const SCALE = { figures: 2.4, gap: 0.4, margin: 0.5, stroke: 0.16, tick: 2.2 };

/** The outside of a vessel from the edge of its base up to its rim. */
function sideOf(vessel: Vessel): Arr.NonEmptyReadonlyArray<OutlinePoint> {
  const span = Math.cbrt(vessel.capacity);
  return Match.value(vessel.kind).pipe(
    Match.when("beaker", (): Arr.NonEmptyReadonlyArray<OutlinePoint> => {
      const radius = (BEAKER.across * span) / 2;
      const height = radius * 2 * BEAKER.tall;
      const corner = radius * 2 * BEAKER.corner;
      const flare = radius * 2 * BEAKER.flare;
      return [
        [radius - corner, 0],
        [radius, corner],
        [radius, height - flare],
        [radius + flare * 0.7, height],
      ];
    }),
    Match.when("conical", (): Arr.NonEmptyReadonlyArray<OutlinePoint> => {
      const radius = (CONICAL.across * span) / 2;
      const height = radius * 2 * CONICAL.tall;
      const corner = radius * 2 * CONICAL.corner;
      const neck = radius * CONICAL.neck;
      const bead = radius * 2 * CONICAL.bead;
      return [
        [radius - corner * 0.6, 0],
        [radius, corner * 0.6],
        [radius, corner],
        [neck, height * (1 - CONICAL.throat)],
        [neck, height - bead],
        [neck + bead * 0.7, height],
      ];
    }),
    Match.exhaustive
  );
}

/** The radius of an outline at a height, held between its two ends. */
function radiusAt(
  side: Arr.NonEmptyReadonlyArray<OutlinePoint>,
  height: number
) {
  return Arr.reduce(
    Arr.zip(side, Arr.drop(side, 1)),
    height < Arr.headNonEmpty(side)[1]
      ? Arr.headNonEmpty(side)[0]
      : Arr.lastNonEmpty(side)[0],
    (radius, [low, high]) => {
      if (height < low[1] || height > high[1]) {
        return radius;
      }
      const share = (height - low[1]) / (high[1] - low[1]);
      return low[0] + (high[0] - low[0]) * share;
    }
  );
}

/**
 * The glass of a vessel: the outline of its outside for a turned part, from
 * the middle of its base up to its rim, the thickness of its wall and of its
 * base, how tall it is, and whether its rim is drawn out into a spout.
 */
export function glassOf(vessel: Vessel) {
  const side = sideOf(vessel);
  const wall = Arr.reduce(side, 0, (most, [radius]) => Math.max(most, radius));
  const outline: readonly OutlinePoint[] = [[0, 0], ...side];
  return {
    base: wall * 2 * WALL * BASE,
    height: Arr.lastNonEmpty(side)[1],
    outline,
    spout: vessel.kind === "beaker",
    wall: wall * 2 * WALL,
  };
}

/**
 * The radius of the space inside a vessel at a height above the bench it
 * stands on: where the liquid, a bubble or a stirrer may be.
 */
export function boreAt(vessel: Vessel, height: number) {
  const glass = glassOf(vessel);
  return Math.max(0, radiusAt(sideOf(vessel), height) - glass.wall - CLEARANCE);
}

/** The heights at which the inside of a vessel changes its slope, from its floor to its rim. */
function stepsOf(vessel: Vessel) {
  const glass = glassOf(vessel);
  return [
    glass.base,
    ...Arr.filter(
      Arr.map(sideOf(vessel), ([, height]) => height),
      (height) => height > glass.base
    ),
  ];
}

/** The volume of the slice of a vessel between two heights, in millilitres. */
function sliceOf(vessel: Vessel, low: number, high: number) {
  const below = boreAt(vessel, low);
  const above = boreAt(vessel, high);
  return (
    ((Math.PI * (high - low)) / 3) *
    (below * below + below * above + above * above) *
    MILLILITRES
  );
}

/** How much a vessel holds up to a height above the bench, in millilitres. */
export function volumeTo(vessel: Vessel, level: number) {
  const steps = stepsOf(vessel);
  return Arr.reduce(
    Arr.zip(steps, Arr.drop(steps, 1)),
    0,
    (volume, [low, high]) =>
      level <= low
        ? volume
        : volume + sliceOf(vessel, low, Math.min(high, level))
  );
}

/**
 * The height above the bench at which the liquid in a vessel stands when it
 * holds a volume: its floor when empty, and its rim when the volume is more
 * than it can hold.
 */
export function levelOf(vessel: Vessel, volume: number) {
  const glass = glassOf(vessel);
  return Arr.reduce(
    Arr.range(1, 40),
    { high: glass.height, low: glass.base },
    ({ high, low }) => {
      const middle = (low + high) / 2;
      return volumeTo(vessel, middle) < volume
        ? { high, low: middle }
        : { high: middle, low };
    }
  ).high;
}

/**
 * The body of the liquid a vessel holds, as the outline of a turned part:
 * it lies on the vessel's floor, follows its wall, climbs the glass in a
 * meniscus and is flat in the middle, where a level is read.
 */
export function liquidOf(
  vessel: Vessel,
  volume: number
): readonly OutlinePoint[] {
  const glass = glassOf(vessel);
  const level = levelOf(vessel, volume);
  const radius = boreAt(vessel, level);
  const reach = Math.min(MENISCUS.reach, radius * 0.6);
  return [
    [0, glass.base],
    ...Arr.map(
      Arr.filter(stepsOf(vessel), (height) => height < level),
      (height): OutlinePoint => [boreAt(vessel, height), height]
    ),
    ...Arr.makeBy(MENISCUS.steps + 1, (step): OutlinePoint => {
      const share = step / MENISCUS.steps;
      return [radius - share * reach, level + MENISCUS.rise * (1 - share) ** 2];
    }),
    [0, level],
  ];
}

/**
 * What a liquid lets through of the red, green and blue light that crosses
 * a width of it, each from 0 to 1, as the Beer-Lambert law has it: every
 * further layer takes the same share out of what is left, so a wide beaker
 * of a solution is deeper and purer in colour than a narrow tube of the
 * same one, and no depth of it lets through more than a thin layer does.
 *
 * @param thin - What a layer one over `strength` metres deep lets through, as linear red, green and blue
 * @param strength - How strongly the liquid absorbs, in such layers for each metre of it
 * @param width - How much liquid the light crosses, in metres
 */
export function filterOf(
  thin: readonly [number, number, number],
  strength: number,
  width: number
) {
  const layers = Math.max(0, strength) * Math.max(0, width);
  return [thin[0] ** layers, thin[1] ** layers, thin[2] ** layers] as const;
}

/**
 * The scale fired on a vessel: a mark at every fifth of its capacity, each
 * at the height the vessel holds that volume, so the marks of a conical
 * flask draw apart toward its neck as they do on a real one, with the
 * capacity written above. `middle` is the height of the sheet's middle above
 * the bench, `radius` the vessel's outside there, and `lean` how far its
 * wall leans in from upright, in radians.
 *
 * @param vessel - The vessel the scale is on
 * @param ink - The colour of the enamel
 * @param format - How a number is written, in the reader's locale
 */
export function scaleOf(
  vessel: Vessel,
  ink: string,
  format: (value: number, digits: number) => string
) {
  const side = sideOf(vessel);
  const marks = Arr.map(MARKS, (fifth) => {
    const volume = (vessel.capacity * fifth) / 5;
    return { level: levelOf(vessel, volume), volume };
  });
  const low = Arr.headNonEmpty(marks).level;
  const high = Arr.lastNonEmpty(marks).level;
  const middle = (low + high) / 2;
  const size = (high - low) / 9;
  const width =
    size * (SCALE.tick + SCALE.gap + SCALE.figures + 2 * SCALE.margin);
  const left = -width / 2 + size * SCALE.margin;
  const sheet: Sheet = {
    height: high - low + size * 5,
    marks: [
      ...Arr.flatMap(marks, (mark) => [
        {
          from: [left, mark.level - middle] as const,
          ink,
          kind: "line" as const,
          to: [left + size * SCALE.tick, mark.level - middle] as const,
          width: size * SCALE.stroke,
        },
        words({
          align: "start",
          at: [left + size * (SCALE.tick + SCALE.gap), mark.level - middle],
          ink,
          size,
          text: format(mark.volume, 0),
        }),
      ]),
      words({
        align: "start",
        at: [left, high - middle + size * 1.6],
        ink,
        size: size * 0.9,
        text: `${format(vessel.capacity, 0)} mL`,
      }),
    ],
    width,
  };
  return {
    lean: Math.atan2(radiusAt(side, low) - radiusAt(side, high), high - low),
    middle,
    radius: radiusAt(side, middle),
    sheet,
  };
}
