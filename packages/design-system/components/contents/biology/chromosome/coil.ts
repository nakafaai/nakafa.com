import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  aside,
  cross,
  length,
  ORIGIN,
  PointSchema,
  scale,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import { Array as Arr, Schema } from "effect";

/**
 * The nucleosome core particle, in nanometres (Luger et al. 1997): 147 base
 * pairs of DNA wrap the histone octamer 1.65 times in a left-handed
 * superhelix 4.18 nm in radius that climbs 2.39 nm a turn.
 */
export const WRAP = { pitch: 2.39, radius: 4.18, turns: 1.65 } as const;

/** The double helix at this scale: 1 nm in radius, one turn every 3.57 nm (10.5 base pairs). */
export const DUPLEX = { period: 3.57, radius: 1 } as const;

/** How far round the helix the second backbone trails the first: the minor groove's 127 degrees. */
const GROOVE = (127 * Math.PI) / 180;

/** Where a nucleosome sits: its middle, and how far it is turned about x from standing with its flat faces along z. */
const SeatSchema = Schema.Struct({ at: PointSchema, tilt: Schema.Finite });
export type Seat = typeof SeatSchema.Type;

/** The direction a path's frame starts from. */
const AHEAD: Point = [0, 0, 1];

/**
 * The path the DNA's axis follows around one histone octamer, in the
 * nucleosome's own frame: the superhelix axis along z, the path's middle on
 * the x axis.
 */
export function wrapOf(samples: number): readonly Point[] {
  return Arr.makeBy(samples, (index) => {
    const angle = (index / (samples - 1) - 0.5) * WRAP.turns * Math.PI * 2;
    return [
      Math.cos(angle) * WRAP.radius,
      Math.sin(angle) * WRAP.radius,
      (-angle / (Math.PI * 2)) * WRAP.pitch,
    ] as const;
  });
}

/**
 * The eight histones of one octamer in the nucleosome's own frame, in
 * nanometres: two layers of four around the superhelix axis, the upper layer
 * turned an eighth of a turn against the lower, each with the kind of histone
 * it is (0 to 3: H2A, H2B, H3, H4).
 */
export function octamerOf() {
  return Arr.makeBy(8, (index) => {
    const layer = index < 4 ? -1 : 1;
    const angle = ((index % 4) / 4 + (layer + 1) / 16) * Math.PI * 2;
    return {
      at: [Math.cos(angle) * 1.7, Math.sin(angle) * 1.7, layer * 1.2] as const,
      kind: (index + (layer + 1) / 2) % 4,
    };
  });
}

/**
 * The two sugar-phosphate backbones of a double helix whose axis follows
 * `axis`: each winds right-handed around it at the helix's radius and period,
 * the second trailing the first by the minor groove, with a frame carried
 * along the path so the helix never twists where the path bends.
 */
export function strandsOf(axis: readonly Point[]) {
  const start = {
    along: 0,
    normal: AHEAD,
    place: ORIGIN,
    tangent: AHEAD,
  };
  const frames = Arr.drop(
    Arr.scan(Arr.zip(axis, Arr.drop(axis, 1)), start, (frame, [from, to]) => {
      const tangent = unit(sub(to, from));
      return {
        along: frame.along + length(sub(to, from)),
        normal: aside(tangent, frame.normal),
        place: to,
        tangent,
      };
    }),
    1
  );
  const strand = (shift: number) =>
    Arr.map(frames, (frame) => {
      const side = cross(frame.tangent, frame.normal);
      const turn = (frame.along / DUPLEX.period) * Math.PI * 2 + shift;
      return add(
        frame.place,
        scale(
          add(scale(frame.normal, Math.cos(turn)), scale(side, Math.sin(turn))),
          DUPLEX.radius
        )
      );
    });
  return { first: strand(0), second: strand(GROOVE) };
}

/** A point of a nucleosome's own frame turned about x by the seat's tilt and moved to its middle. */
export function seated(point: Point, seat: Seat): Point {
  const cos = Math.cos(seat.tilt);
  const sin = Math.sin(seat.tilt);
  return add(seat.at, [
    point[0],
    point[1] * cos - point[2] * sin,
    point[1] * sin + point[2] * cos,
  ]);
}

/**
 * The path one unbroken DNA follows through a row of nucleosomes: around
 * each octamer in turn, `samples` points to a wrap, with the linker DNA
 * between two nucleosomes left to the curve drawn through the points.
 */
export function pathOf(seats: readonly Seat[], samples: number) {
  return Arr.flatMap(seats, (seat) =>
    Arr.map(wrapOf(samples), (point) => seated(point, seat))
  );
}

/**
 * Beads on a string, the 11 nm fibre, in nanometres along x: `count`
 * nucleosomes a linker of some 50 base pairs apart, each turned a little
 * differently and none quite on the line, as in a spread of chromatin.
 */
export function stringOf(count: number): readonly Seat[] {
  return Arr.makeBy(count, (index) => ({
    at: [
      (index - (count - 1) / 2) * 21,
      Math.sin(index * 2.3) * 2.6,
      Math.cos(index * 1.7) * 2.2,
    ] as const,
    tilt: 0.5 + index * 1.1,
  }));
}

/**
 * Where the nucleosomes of a 30 nm fibre sit, in nanometres, with the fibre
 * along x: a left-handed solenoid of six nucleosomes a turn, 11 nm a turn,
 * their middles 10.5 nm from its axis, each with its flat faces looking out
 * from the axis (Finch and Klug 1976).
 */
export function solenoidOf(count: number): readonly Seat[] {
  return Arr.makeBy(count, (index) => {
    const angle = (-index / 6) * Math.PI * 2;
    return {
      at: [
        (index / 6 - (count - 1) / 12) * 11,
        Math.cos(angle) * 10.5,
        Math.sin(angle) * 10.5,
      ] as const,
      tilt: angle - Math.PI / 2,
    };
  });
}
