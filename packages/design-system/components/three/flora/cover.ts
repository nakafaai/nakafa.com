import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { soilHeight } from "@repo/design-system/components/three/flora/crumb";
import type { Limb } from "@repo/design-system/components/three/flora/limb";
import { placeAt } from "@repo/design-system/components/three/flora/limb";
import type { Point } from "@repo/design-system/components/three/form/path";
import {
  add,
  cross,
  dot,
  scale,
  sub,
  unit,
} from "@repo/design-system/components/three/form/path";
import { Array as Arr, Schema } from "effect";

/** The golden angle, by which each next frond or lobe turns about the middle of its plant. */
const TURN = Math.PI * (3 - Math.sqrt(5));

/** Straight up, and the crown a plant grows from. */
const UP: Point = [0, 1, 0];
const CROWN: Point = [0, 0, 0];

/**
 * A fern: how many fronds leave its crown, how long a frond is, how many
 * pairs of leaflets a frond carries and which fern it is.
 */
const FernSchema = Schema.Struct({
  fronds: Schema.Int,
  length: Schema.Finite,
  pinnae: Schema.Int,
  seed: Schema.Int,
});
export type Fern = typeof FernSchema.Type;

/**
 * A cushion of moss: how many shoots stand on it, how long a shoot is, how
 * far the cushion reaches from its middle, how high it is heaped there and
 * which cushion it is.
 */
const MossSchema = Schema.Struct({
  blade: Schema.Finite,
  count: Schema.Int,
  heap: Schema.Finite,
  radius: Schema.Finite,
  seed: Schema.Int,
});
export type Moss = typeof MossSchema.Type;

/**
 * A crust of leafy lichen: how many lobes it has, how far it reaches over
 * the rock and which crust it is.
 */
const LichenSchema = Schema.Struct({
  lobes: Schema.Int,
  radius: Schema.Finite,
  seed: Schema.Int,
});
export type Lichen = typeof LichenSchema.Type;

/**
 * Fallen leaves on the ground: how many, how large one is, how far they are
 * scattered and which scatter it is.
 */
const LitterSchema = Schema.Struct({
  blade: Schema.Finite,
  count: Schema.Int,
  radius: Schema.Finite,
  seed: Schema.Int,
});
export type Litter = typeof LitterSchema.Type;

/** The numbers that place one leaf: where it is, the way it points, the way its upper face looks, its size and its tone. */
function leaf(
  place: Point,
  heading: Point,
  toward: Point,
  size: number,
  tone: number
) {
  const along = unit(heading);
  const face = unit(sub(toward, scale(along, dot(toward, along))));
  return [...place, ...along, ...face, size, tone];
}

/**
 * The midrib of one frond of a fern, from the crown out: it leaves almost
 * upright, arches over and droops at its tip under its own weight. It has
 * one place for the crown, one for each pair of leaflets and one for its tip.
 */
export function frondPath(fern: Fern, index: number): readonly Point[] {
  const turn = index * TURN + chanceAt(index, 1, fern.seed) * 0.5;
  const out: Point = [Math.cos(turn), 0, Math.sin(turn)];
  const reach = fern.length * (0.7 + 0.3 * chanceAt(index, 2, fern.seed));
  const steps = fern.pinnae + 1;
  const lean = 0.25 + 0.3 * chanceAt(index, 3, fern.seed);
  return Arr.scan(Arr.range(1, steps), CROWN, (place, step) => {
    const droop = lean + 1.55 * (step / steps) ** 1.3;
    return add(
      place,
      scale(
        add(scale(out, Math.sin(droop)), scale(UP, Math.cos(droop))),
        reach / steps
      )
    );
  });
}

/**
 * A fern grown from its crown: each frond's midrib as a limb to sweep, and
 * its leaflets as the numbers that place a leaf each. The leaflets stand in
 * pairs along the midrib, longest a third of the way out and shortening to
 * the tip, and lie in the plane of the frond.
 */
export function growFern(fern: Fern) {
  const fronds = Arr.map(Arr.range(0, fern.fronds - 1), (index) =>
    frondPath(fern, index)
  );
  return {
    leaves: Arr.flatMap(fronds, (path, index) =>
      Arr.flatMap(Arr.range(1, fern.pinnae), (step) => {
        const place = placeAt(path, step);
        const along = unit(
          sub(placeAt(path, step + 1), placeAt(path, step - 1))
        );
        const side = unit(cross(along, UP));
        const share = step / (fern.pinnae + 1);
        const size =
          fern.length *
          0.3 *
          Math.sin(Math.PI * (0.1 + 0.9 * share)) ** 0.7 *
          (1 - 0.45 * share);
        const toward = unit(cross(side, along));
        return Arr.flatMap([-1, 1] as const, (hand) =>
          leaf(
            place,
            add(scale(side, hand), scale(along, 0.45)),
            toward,
            size,
            chanceAt(index * 97 + step, hand + 2, fern.seed)
          )
        );
      })
    ),
    limbs: Arr.map(
      fronds,
      (path, index): Limb => ({
        arc: 1,
        base: fern.length * 0.016,
        flare: 0,
        furrow: 0,
        path,
        seed: fern.seed + index,
        sides: 5,
        tip: fern.length * 0.004,
      })
    ),
  };
}

/**
 * The shoots of a cushion of moss, as the numbers that place a leaf each:
 * crowded, upright and leaning out from the dome they stand on, so the
 * cushion reads as soft pile and not as a painted lump.
 */
export function growMoss(moss: Moss) {
  const bed = {
    count: 0,
    heap: moss.heap,
    radius: moss.radius,
    seed: moss.seed,
  };
  return Arr.flatMap(Arr.range(0, moss.count - 1), (index) => {
    const turn = chanceAt(index, 1, moss.seed) * 2 * Math.PI;
    const far = Math.sqrt(chanceAt(index, 2, moss.seed)) * moss.radius * 0.96;
    const x = Math.cos(turn) * far;
    const z = Math.sin(turn) * far;
    const lean = chanceAt(index, 3, moss.seed) * 2 * Math.PI;
    const slope = (2 * moss.heap) / moss.radius ** 2;
    const heading: Point = [
      slope * x + 0.3 * Math.cos(lean),
      1,
      slope * z + 0.3 * Math.sin(lean),
    ];
    return leaf(
      [x, soilHeight(bed, x, z), z],
      heading,
      [-Math.sin(lean), 0.2, Math.cos(lean)],
      moss.blade * (0.6 + 0.8 * chanceAt(index, 4, moss.seed)),
      chanceAt(index, 5, moss.seed)
    );
  });
}

/**
 * The lobes of a leafy lichen, as the numbers that place a leaf each: they
 * lie flat on the rock in rings around the place the crust began, the newest
 * and largest at the rim, each a little lifted at its edge.
 */
export function growLichen(lichen: Lichen) {
  return Arr.flatMap(Arr.range(0, lichen.lobes - 1), (index) => {
    const turn = index * TURN;
    const ring = Math.sqrt((index + 0.5) / lichen.lobes);
    const far = ring * lichen.radius * 0.55;
    const lift = 0.06 + 0.16 * chanceAt(index, 1, lichen.seed);
    return leaf(
      [Math.cos(turn) * far, 0.004 * ring, Math.sin(turn) * far],
      [Math.cos(turn), lift, Math.sin(turn)],
      UP,
      lichen.radius * (0.3 + 0.25 * ring),
      chanceAt(index, 2, lichen.seed)
    );
  });
}

/**
 * Fallen leaves, as the numbers that place a leaf each: thick at the middle
 * of the scatter and thin at its rim, each lying nearly flat at its own turn,
 * a few curled up off the ground.
 */
export function growLitter(litter: Litter) {
  return Arr.flatMap(Arr.range(0, litter.count - 1), (index) => {
    const turn = chanceAt(index, 1, litter.seed) * 2 * Math.PI;
    const far = chanceAt(index, 2, litter.seed) ** 0.8 * litter.radius;
    const spin = chanceAt(index, 3, litter.seed) * 2 * Math.PI;
    const curl = 0.04 + 0.3 * chanceAt(index, 4, litter.seed) ** 3;
    const size = litter.blade * (0.6 + 0.6 * chanceAt(index, 5, litter.seed));
    return leaf(
      [Math.cos(turn) * far, 0.003 + size * curl * 0.3, Math.sin(turn) * far],
      [Math.cos(spin), curl, Math.sin(spin)],
      UP,
      size,
      chanceAt(index, 6, litter.seed)
    );
  });
}
