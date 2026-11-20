import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Match, Schema } from "effect";

/**
 * One mitochondrion in the cytoplasm of an animal or yeast cell, cut open
 * lengthwise, at the scale of a transmission electron micrograph: one scene
 * unit is one micrometre. x runs along the organelle, y up and z towards the
 * reader. The cut is the plane z = 0 and the reader looks into the back half,
 * so everything the organelle draws lies at z ≤ 0.
 */
const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
export type Point = typeof PointSchema.Type;

/**
 * How many times the nanometre layers are drawn thicker than they are: the
 * membranes, the space between them and the space inside a crista. At their
 * true 7 nm a membrane would be under one pixel wide on a phone, so the layers
 * are thickened alike and keep their proportions to each other; the organelle
 * itself, its cristae and the particles in it keep their real size.
 */
export const EMPHASIS = 2;

/**
 * The organelle: 2 µm long and 0.8 µm across, inside the 0.5 to 1 µm width
 * and 1 to 8 µm length that cell biology texts give (The Open University, "A
 * tour of the cell", 4.10; NIGMS, "Inside the Cell", ch. 1) and close to the
 * 0.86 to 0.9 µm of the tomograms in Mannella, Ann. N. Y. Acad. Sci. 1147,
 * 2008.
 */
export const BODY = { length: 2, radius: 0.4 } as const;

/** Half the length of the straight middle between the two rounded ends. */
const STRAIGHT = BODY.length / 2 - BODY.radius;

/**
 * One lipid bilayer, drawn: each membrane is about 7 nm thick in electron
 * tomograms (Perkins et al., J. Struct. Biol. 119, 1997).
 */
export const MEMBRANE = 0.007 * EMPHASIS;

/**
 * The intermembrane space, drawn: the outer membrane and the inner boundary
 * membrane together measure about 22 nm (Perkins et al. 1997), so about 8 nm
 * lies between them.
 */
export const INTERMEMBRANE = 0.008 * EMPHASIS;

/**
 * The space inside a crista, drawn: about 12 to 15 nm wide in cryo-electron
 * tomograms of animal and algal mitochondria (Communications Biology 7, 2024,
 * doi:10.1038/s42003-024-06045-4).
 */
const LUMEN = 0.014 * EMPHASIS;

/** Half the thickness of a crista: one membrane and half its lumen. */
export const CRISTA_HALF = MEMBRANE + LUMEN / 2;

/**
 * How far each surface lies in from the outer face of the outer membrane: the
 * outer membrane's two faces, then the inner boundary membrane's, whose inner
 * face is the wall of the matrix.
 */
export const INSET = {
  matrix: 2 * MEMBRANE + INTERMEMBRANE,
  outer: 0,
  outerBack: MEMBRANE,
  inner: MEMBRANE + INTERMEMBRANE,
} as const;

/** How far the middle of the organelle bows up from its ends, in micrometres. */
const ARCH = 0.05;

/** How far the wall swells or narrows from round, as a share of its radius. */
const SWELL = 0.03;

/** The height of the organelle's axis at `x`: a gentle bean-like bow. */
export function arch(x: number) {
  const share = x / (BODY.length / 2);
  return ARCH * (1 - share * share);
}

/** How much the wall swells at `x` and angle `theta` around the axis, near 1. */
export function swell(x: number, theta: number) {
  return 1 + SWELL * (2 * valueNoise(x * 2.2 + 5.3, theta * 1.4 + 2.1, 64) - 1);
}

/**
 * The radius of the surface `inset` in from the outer face, at `x` along the
 * axis, before it swells: constant along the middle and rounding off over the
 * ends, 0 beyond the tip.
 */
export function sectionRadius(x: number, inset: number) {
  const radius = BODY.radius - inset;
  const beyond = Math.abs(x) - STRAIGHT;
  if (beyond <= 0) {
    return radius;
  }
  return Math.sqrt(Math.max(0, radius * radius - beyond * beyond));
}

/** The share of the outline from tip to tip that each rounded end takes. */
const CAP_SHARE =
  (Math.PI * BODY.radius) / 2 / (Math.PI * BODY.radius + 2 * STRAIGHT);

/**
 * A point of the surface `inset` in, from its left tip (`along` 0) to its
 * right tip (`along` 1), at angle `theta` around the axis: π is the bottom
 * edge of the cut, 3π/2 the back and 2π the top edge. Every surface shares
 * these coordinates, so the layers stay parallel.
 */
export function bodyPoint(along: number, theta: number, inset: number): Point {
  const radius = BODY.radius - inset;
  const [x, reach] = meridian(along, radius);
  const swollen = reach * swell(x, theta);
  return [x, arch(x) + swollen * Math.cos(theta), swollen * Math.sin(theta)];
}

/** Where `along` falls on the outline of radius `radius`: its x and its distance from the axis. */
function meridian(along: number, radius: number) {
  if (along < CAP_SHARE) {
    const angle = (along / CAP_SHARE) * (Math.PI / 2);
    return [-STRAIGHT - radius * Math.cos(angle), radius * Math.sin(angle)];
  }
  if (along > 1 - CAP_SHARE) {
    const angle = ((along - 1 + CAP_SHARE) / CAP_SHARE) * (Math.PI / 2);
    return [STRAIGHT + radius * Math.sin(angle), radius * Math.cos(angle)];
  }
  const share = (along - CAP_SHARE) / (1 - 2 * CAP_SHARE);
  return [-STRAIGHT + 2 * STRAIGHT * share, radius];
}

/** Which side of the inner boundary membrane a crista folds in from. */
const AttachSchema = Schema.Literals(["top", "bottom", "both"]);

/** A stretch of the wall, as the angles round the axis it runs between. */
const SlotSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

/**
 * One lamellar crista: a flattened sac of inner membrane across the matrix,
 * its plane near x, tipped by `tilt` and bowed by `bow`. It folds out of the
 * inner boundary membrane through slot-like crista junctions along `slots`,
 * where its lumen opens into the intermembrane space, and its free rim stands
 * back from the wall everywhere else, by `depth` of the radius more on the
 * side it does not fold in from.
 */
const CristaSchema = Schema.Struct({
  attach: AttachSchema,
  bow: Schema.Finite,
  depth: Schema.Finite,
  seed: Schema.Int,
  slots: Schema.Array(SlotSchema),
  tilt: Schema.Finite,
  x: Schema.Finite,
});
export type Crista = typeof CristaSchema.Type;

/**
 * How many cristae cross this organelle, and how far the outermost stand from
 * its middle: just inside its rounded ends, so every fold meets the wall
 * square, as cristae there turn to follow the curve.
 */
const CRISTA_COUNT = 9;
const CRISTA_REACH = 0.73;

/**
 * The matrix left between a crista's free rim and the inner boundary
 * membrane, where the ATP synthase heads stand on the rim, in micrometres.
 */
const RIM_GAP = 0.07;

/**
 * The radius over which a crista's two membranes bend into the boundary
 * membrane at a junction, so the fold flares as a membrane does where it
 * turns, about as wide again as the crista.
 */
export const FILLET = CRISTA_HALF;

/**
 * How far along the wall, in micrometres, a crista's rim takes to peel away
 * from the boundary membrane at either end of a junction.
 */
const SLOT_RAMP = 0.12;

/** The side each crista folds in from, by its place in the row. */
function attachOf(index: number) {
  return Match.value((index * 2) % 3).pipe(
    Match.when(0, () => "top" as const),
    Match.when(1, () => "bottom" as const),
    Match.orElse(() => "both" as const)
  );
}

/**
 * The slot-like junctions a crista folds out of, running from the cut edge
 * on the side it folds in from, `span` of the half turn round the wall.
 * Tomograms show cristae opening into the boundary membrane at narrow
 * circular or slot-like junctions, their bore 10 to 40 nm (Mannella, Ann. N.
 * Y. Acad. Sci. 1147, 2008; Mannella, Lederer and Jafri, J. Mol. Cell.
 * Cardiol., 2013); the lamellar cristae drawn here open by slots.
 */
function slotsOf(attach: typeof AttachSchema.Type, span: number) {
  const bottom = [Math.PI, Math.PI * (1 + span)] as const;
  const top = [Math.PI * (2 - span), 2 * Math.PI] as const;
  return Match.value(attach).pipe(
    Match.when("top", () => [top]),
    Match.when("bottom", () => [bottom]),
    Match.when("both", () => [bottom, top]),
    Match.exhaustive
  );
}

/** The cristae, evenly spaced along the organelle with a little scatter. */
export const CRISTAE: readonly Crista[] = Arr.map(
  Arr.range(0, CRISTA_COUNT - 1),
  (index) => {
    const attach = attachOf(index);
    return {
      attach,
      bow: (hashUnit(index, 9) - 0.5) * 0.03,
      depth: 0.1 + 0.55 * hashUnit(index, 11),
      seed: index,
      slots: slotsOf(attach, 0.14 + 0.12 * hashUnit(index, 13)),
      tilt: (hashUnit(index, 7) - 0.5) * 0.08,
      x:
        -CRISTA_REACH +
        (2 * CRISTA_REACH * index) / (CRISTA_COUNT - 1) +
        (hashUnit(index, 3) - 0.5) * 0.03,
    };
  }
);

/**
 * The crista's plane at `y` and `z`: where its middle runs across the
 * matrix, tipped, bowed, and rippled a little as a membrane sheet is.
 */
export function cristaX(crista: Crista, y: number, z: number) {
  const across = (y - arch(crista.x)) / BODY.radius;
  const ripple =
    0.007 * Math.sin(y * 11 + crista.seed) * Math.cos(z * 9 + crista.seed);
  return crista.x + crista.tilt * z + crista.bow * across * across + ripple;
}

/**
 * How firmly a crista is joined to the wall at `theta`: 1 along a junction,
 * easing to 0 within `SLOT_RAMP` of its ends.
 */
export function attachment(crista: Crista, theta: number) {
  return Arr.reduce(crista.slots, 0, (most, [from, to]) => {
    const outside = Math.max(from - theta, theta - to, 0) * BODY.radius;
    const near = Math.max(0, 1 - outside / SLOT_RAMP);
    return Math.max(most, near * near * (3 - 2 * near));
  });
}

/**
 * How far a crista's rim keeps back from the wall at `theta`. Along a
 * junction it reaches through the boundary membrane instead, so its lumen
 * opens into the intermembrane space.
 */
function margin(crista: Crista, theta: number) {
  const share = (theta - Math.PI) / Math.PI;
  const away = Match.value(crista.attach).pipe(
    Match.when("top", () => (1 - share) ** 2),
    Match.when("bottom", () => share ** 2),
    Match.when("both", () => 0),
    Match.exhaustive
  );
  const wave = valueNoise(theta * 2.5 + crista.seed * 3.1, crista.seed, 64);
  const free = RIM_GAP + crista.depth * BODY.radius * away + 0.015 * wave;
  const held = attachment(crista, theta);
  return free * (1 - held) - (CRISTA_HALF + MEMBRANE) * held;
}

/** The radius of the matrix wall at the crista's place and `theta`. */
export function wallReach(crista: Crista, theta: number) {
  return sectionRadius(crista.x, INSET.matrix) * swell(crista.x, theta);
}

/** How far a crista's rim reaches from the axis at `theta`. */
export function cristaReach(crista: Crista, theta: number) {
  return wallReach(crista, theta) - margin(crista, theta);
}

/**
 * How far a crista's face, `inset` in, flares out at `distance` from the
 * axis where it bends into the boundary membrane at `wall`: a quarter round
 * of `FILLET` plus `inset`, so the fold keeps its membrane's thickness and
 * meets the wall square.
 */
function flare(distance: number, wall: number, inset: number) {
  const radius = FILLET + inset;
  const into = Math.min(radius, Math.max(0, distance - wall + FILLET));
  return radius - Math.sqrt(radius * radius - into * into);
}

/**
 * A point on one face of a crista, at angle `theta` and `across` from the
 * axis (0) to the rim (1): its last quarter rounds over the rim, so the two
 * faces (`face` -1 and 1) meet in a rounded edge as a membrane fold does, and
 * where the crista reaches the wall its faces flare into it, closing just
 * inside the intermembrane space. `inset` draws the lumen's outline instead,
 * one membrane in.
 */
export function cristaPoint(
  crista: Crista,
  theta: number,
  across: number,
  face: number,
  inset = 0
): Point {
  const half = CRISTA_HALF - inset;
  const wall = wallReach(crista, theta);
  const flat = cristaReach(crista, theta) - CRISTA_HALF;
  const round = Math.max(0, (across - 0.75) / 0.25) * (Math.PI / 2);
  const tip = half * (1 - 0.9 * attachment(crista, theta));
  const distance =
    across <= 0.75 ? (across / 0.75) * flat : flat + tip * Math.sin(round);
  const offset =
    across <= 0.75
      ? half + flare(distance, wall, inset)
      : (half + flare(flat, wall, inset)) * Math.cos(round);
  const y = arch(crista.x) + distance * Math.cos(theta);
  const z = distance * Math.sin(theta);
  return [cristaX(crista, y, z) + face * offset, y, z];
}

/** The two cristae on either side of matrix gap `gap`, numbered from the left. */
function bounds(gap: number) {
  return [
    Arr.getUnsafe(CRISTAE, gap),
    Arr.getUnsafe(CRISTAE, gap + 1),
  ] as const;
}

/** How many matrix gaps lie between the cristae. */
export const GAP_COUNT = CRISTA_COUNT - 1;

/**
 * The matrix gaps the molecules of each of the three glucose journeys cross
 * by, two each, so different cristae work in turn; the end gaps stay quiet
 * and hold the nucleoids.
 */
export const LANES = [
  [1, 3],
  [2, 4],
  [3, 5],
] as const;

/** The gaps no journey crosses. */
export const QUIET_GAPS = [0, 6, 7] as const;

/**
 * How far in front of the cut the molecules travel, in micrometres: in the
 * plane of the section, where the matrix and cytosol go on in the half cut
 * away, so a molecule reads at a glance and never passes through a crista.
 */
export const FRONT = 0.05;

/** The middle of matrix gap `gap` at `y` and `z`, halfway between the faces that bound it. */
export function gapMiddle(gap: number, y: number, z: number) {
  const [left, right] = bounds(gap);
  return (cristaX(left, y, z) + cristaX(right, y, z)) / 2;
}

/** How far a point at `x`, `y`, `z` in gap `gap` stays clear of the crista faces on either side. */
export function gapClearance(gap: number, [x, y, z]: Point) {
  const [left, right] = bounds(gap);
  return Math.min(
    x - cristaX(left, y, z) - CRISTA_HALF,
    cristaX(right, y, z) - x - CRISTA_HALF
  );
}

/**
 * A point in matrix gap `gap` at angle `theta`, `share` of the way from the
 * axis to the wall of the matrix, `offset` from the gap's middle.
 */
export function gapPoint(
  gap: number,
  theta: number,
  share: number,
  offset = 0
): Point {
  const middle = gapMiddle(gap, 0, 0);
  const distance = share * sectionRadius(middle, INSET.matrix);
  const y = arch(middle) + distance * Math.cos(theta);
  const z = distance * Math.sin(theta);
  return [gapMiddle(gap, y, z) + offset, y, z];
}

/**
 * A point in the plane of the molecules, `height` above the axis, just off
 * the cut face of the crista on the `side` of gap `gap`, `lift` clear of it.
 */
export function facePoint(
  gap: number,
  side: "left" | "right",
  height: number,
  lift: number
): Point {
  const [left, right] = bounds(gap);
  const crista = side === "left" ? left : right;
  const y = arch(crista.x) + height;
  const sign = side === "left" ? 1 : -1;
  return [cristaX(crista, y, 0) + sign * (CRISTA_HALF + lift), y, FRONT];
}
