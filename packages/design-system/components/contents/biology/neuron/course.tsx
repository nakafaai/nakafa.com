import { G_RATIO } from "@repo/design-system/components/contents/biology/neuron/conduction";
import {
  CUT,
  END,
} from "@repo/design-system/components/contents/biology/neuron/playback";
import {
  HILLOCK,
  SOMA,
} from "@repo/design-system/components/contents/biology/neuron/soma";
import { useClipping } from "@repo/design-system/components/contents/biology/surface";
import { Array as Arr } from "effect";
import { CatmullRomCurve3, Plane, Vector3 } from "three";

/**
 * The fibre's drawn size, in units of 10 µm: 12 µm across its myelin, the
 * width of a fast α motor fibre (Erlanger and Gasser's Aα group, 13 to 20
 * µm), with the axon 0.6 of that (Rushton's g-ratio) and pinched to a
 * little less at each node, and the bare initial segment a little thinner.
 * A bare fibre's axon is drawn 3.6 µm across, more than three times a 1 µm
 * C fibre, so it stays visible beside the myelinated one while it still
 * reads as much thinner.
 */
export const FIBRE = {
  axon: 0.6 * G_RATIO,
  bare: 0.18,
  initial: 0.3,
  node: 0.27,
  outer: 0.6,
} as const;

/**
 * One internode as drawn, 5 units: a real one is 100 fibre diameters, 120
 * units at this scale, so the drawing shortens the axon 24 times along its
 * length while it keeps its width, and the 1 µm node, true. The cut leaves
 * out the rest of the axon's length.
 */
export const SPACING = 5;

/** How far along the near stretch the initial segment ends and the first internode begins. */
export const INITIAL = 2.5;

/** Where the axon starts, inside the hillock's cone. */
const START = SOMA.centre
  .clone()
  .addScaledVector(
    new Vector3(
      HILLOCK.direction.x,
      HILLOCK.direction.y,
      HILLOCK.direction.z * SOMA.depth
    ).normalize(),
    SOMA.radius + 1
  );

/** A smooth path through `points`. */
function path(points: readonly (readonly [number, number, number])[]) {
  return new CatmullRomCurve3(
    Arr.map(points, ([x, y, z]) => new Vector3(x, y, z)),
    false,
    "centripetal"
  );
}

/**
 * The near stretch, from the hillock across the top of the card to the cut,
 * and the far stretch, from the cut down the right and in over the muscle.
 * Each runs a little past its cut so the cut can be a slanted plane.
 */
export const NEAR = path([
  [START.x, START.y, START.z],
  [-5.3, 4.55, 0.4],
  [-1, 3.35, 0.5],
  [3.4, 3.05, 0.2],
  [7.3, 2.45, -0.2],
  [10.6, 1.25, -0.5],
  [12.9, 0.3, -0.7],
]);
export const FAR = path([
  [11.2, 1, -0.8],
  [12.6, 0.2, -0.66],
  [13.3, -1.9, -0.4],
  [12.6, -4.6, 0.2],
  [10.4, -6.5, 0.8],
  [7.2, -7.2, 1.2],
  [4.6, -7.35, 1.35],
]);

/** Arc lengths along each stretch where the cut falls. */
export const NEAR_CUT = INITIAL + CUT * SPACING;
export const FAR_CUT = 2.6;

/** The point and direction `length` units along `curve`. */
function station(curve: CatmullRomCurve3, length: number) {
  const share = Math.min(1, Math.max(0, length / curve.getLength()));
  return {
    point: curve.getPointAt(share),
    share,
    tangent: curve.getTangentAt(share),
  };
}

/**
 * Where drawn position `place` (in internodes from the initial segment)
 * lies: on the near stretch up to the cut, on the far one beyond it.
 */
export function stationOf(place: number) {
  return place <= CUT
    ? { ...station(NEAR, INITIAL + place * SPACING), stretch: "near" as const }
    : {
        ...station(FAR, FAR_CUT + (place - CUT) * SPACING),
        stretch: "far" as const,
      };
}

/** The share of each stretch that a length along it is. */
export function shareOf(stretch: "far" | "near", length: number) {
  return length / (stretch === "near" ? NEAR : FAR).getLength();
}

/** The arc length along its stretch of drawn position `place`. */
export function lengthOf(place: number) {
  return place <= CUT
    ? INITIAL + place * SPACING
    : FAR_CUT + (place - CUT) * SPACING;
}

/**
 * The slanted planes of the cut, turned 45 degrees toward the reader so the
 * cut faces show their layers: each keeps the axon on its own side.
 */
function slant(curve: CatmullRomCurve3, length: number, side: 1 | -1) {
  const { point, tangent } = station(curve, length);
  const normal = tangent
    .clone()
    .multiplyScalar(side)
    .add(new Vector3(0, 0, 1))
    .normalize();
  return {
    normal,
    plane: new Plane(normal.clone().negate(), normal.dot(point)),
    point,
    tangent,
  };
}
export const CUTS = {
  far: slant(FAR, FAR_CUT, -1),
  near: slant(NEAR, NEAR_CUT, 1),
} as const;

/** The far stretch's end, where the myelin stops and the terminal branches begin. */
export const BRANCHING = station(FAR, FAR_CUT + (END - CUT) * SPACING);

/** Turns on the clipping the cut faces need. */
export function Clipping() {
  useClipping();
  return null;
}
