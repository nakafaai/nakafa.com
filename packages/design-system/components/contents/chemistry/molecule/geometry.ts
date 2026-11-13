import { ElementSymbolSchema } from "@repo/design-system/components/contents/chemistry/molecule/elements";
import { Array as Arr, Data, Option, Result, Schema } from "effect";

/** A point or a direction in a lab's scene, in scene units of 100 pm. */
export const PointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Point = typeof PointSchema.Type;

/** One atom of a drawn molecule: its element and where it stands. */
export const AtomSchema = Schema.Struct({
  element: ElementSymbolSchema,
  position: PointSchema,
});

/** How many picometres one scene unit spans. */
export const PICOMETRES_PER_UNIT = 100;

/** A bond between two atoms of one molecule, by their indexes. */
export const BondSchema = Schema.Struct({
  /** The elements of the two atoms, from first to last. */
  elements: Schema.Tuple([ElementSymbolSchema, ElementSymbolSchema]),
  from: Schema.Int,
  order: Schema.Literals([1, 2, 3]),
  to: Schema.Int,
});
export type Bond = typeof BondSchema.Type;

/**
 * One atom of a molecule placed the way chemists write a Z-matrix: the length
 * of its bond to an earlier atom, the angle it makes with a second, and the
 * dihedral twist about a third. The first atom stands at the origin and the
 * second, which names no angle, along +x. Every later atom names its angle; one
 * without a dihedral turns in the xy plane, so a molecule's first three atoms
 * face the lab's camera.
 */
export const PlacementSchema = Schema.Struct({
  angle: Schema.optional(
    Schema.Struct({ degrees: Schema.Finite, to: Schema.Int })
  ),
  bond: Schema.optional(
    Schema.Struct({
      length: Schema.Finite,
      order: Schema.optional(Schema.Literals([1, 2, 3])),
      to: Schema.Int,
    })
  ),
  dihedral: Schema.optional(
    Schema.Struct({ degrees: Schema.Finite, to: Schema.Int })
  ),
  element: ElementSymbolSchema,
});
export type Placement = typeof PlacementSchema.Type;

/** A placement that names an atom placed after it, or no atom at all. */
export class PlacementReferenceError extends Data.TaggedError(
  "PlacementReferenceError"
)<{ readonly atom: number; readonly reference: number }> {}

/** Below this length a cross product is treated as zero: the atoms are in line. */
const COLLINEAR = 1e-9;

function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtract(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Point, factor: number): Point {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

function cross(a: Point, b: Point): Point {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a: Point, b: Point) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function length(a: Point) {
  return Math.sqrt(dot(a, a));
}

function normalize(a: Point): Point {
  return scale(a, 1 / length(a));
}

/** Any unit direction square to `axis`, for atoms placed along a straight chain. */
function perpendicular(axis: Point): Point {
  const helper: Point = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize(cross(axis, helper));
}

/** The angle at `vertex` between the atoms `a` and `b`, in degrees. */
export function measureAngle(a: Point, vertex: Point, b: Point) {
  const first = normalize(subtract(a, vertex));
  const second = normalize(subtract(b, vertex));
  const cosine = Math.min(1, Math.max(-1, dot(first, second)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

/** The distance between two atoms, in picometres. */
export function measureDistance(a: Point, b: Point) {
  return length(subtract(a, b)) * PICOMETRES_PER_UNIT;
}

/** Reads an entry placed earlier than `atom`, or fails with the reference. */
function earlier<Entry>(
  placed: readonly Entry[],
  atom: number,
  reference: number
): Result.Result<Entry, PlacementReferenceError> {
  if (reference >= atom) {
    return Result.fail(new PlacementReferenceError({ atom, reference }));
  }
  return Option.match(Arr.get(placed, reference), {
    onNone: () => Result.fail(new PlacementReferenceError({ atom, reference })),
    onSome: Result.succeed,
  });
}

/**
 * Places one atom from its bond length, bond angle, and dihedral, by the
 * natural extension reference frame (Parsons et al. 2005): the bond points
 * back along the chain, turned by the angle and twisted by the dihedral.
 */
function placeAtom(
  placed: readonly Point[],
  atom: number,
  placement: Placement
): Result.Result<Point, PlacementReferenceError> {
  const { bond } = placement;
  if (bond === undefined) {
    return Result.succeed([0, 0, 0]);
  }
  const bondLength = bond.length / PICOMETRES_PER_UNIT;
  const theta = ((placement.angle?.degrees ?? 180) * Math.PI) / 180;
  const phi = ((placement.dihedral?.degrees ?? 0) * Math.PI) / 180;

  return Result.gen(function* () {
    const c = yield* earlier(placed, atom, bond.to);
    if (placement.angle === undefined) {
      return add(c, [bondLength, 0, 0]);
    }
    const b = yield* earlier(placed, atom, placement.angle.to);
    const bc = normalize(subtract(c, b));
    const a =
      placement.dihedral === undefined
        ? undefined
        : yield* earlier(placed, atom, placement.dihedral.to);
    // Without a dihedral the atom turns in the xy plane, about +z.
    const normalCross: Point =
      a === undefined ? [0, 0, 1] : cross(subtract(b, a), bc);
    const n =
      length(normalCross) < COLLINEAR
        ? perpendicular(bc)
        : normalize(normalCross);
    const m = cross(n, bc);
    const along = -bondLength * Math.cos(theta);
    const across = bondLength * Math.sin(theta);
    return add(
      c,
      add(
        scale(bc, along),
        add(scale(m, across * Math.cos(phi)), scale(n, across * Math.sin(phi)))
      )
    );
  });
}

/** The point halfway through every atom, which a molecule turns about. */
export function centroid(points: readonly Point[]): Point {
  const total = Arr.reduce(points, [0, 0, 0] as Point, add);
  return scale(total, 1 / Math.max(1, points.length));
}

/**
 * Builds the atom positions of a molecule from its Z-matrix, centred on the
 * molecule's middle, with one bond for each placement that names one.
 */
export function buildMolecule(placements: readonly Placement[]) {
  return Result.gen(function* () {
    let placed: readonly Point[] = [];
    let bonds: readonly Bond[] = [];
    for (const [atom, placement] of Arr.map(
      placements,
      (each, index) => [index, each] as const
    )) {
      const point = yield* placeAtom(placed, atom, placement);
      placed = Arr.append(placed, point);
      const { bond } = placement;
      if (bond !== undefined) {
        const partner = yield* earlier(placements, atom, bond.to);
        bonds = Arr.append(bonds, {
          elements: [partner.element, placement.element],
          from: bond.to,
          order: bond.order ?? 1,
          to: atom,
        });
      }
    }
    const middle = centroid(placed);
    const positions = Arr.map(placed, (point) => subtract(point, middle));
    return { bonds, positions };
  });
}
