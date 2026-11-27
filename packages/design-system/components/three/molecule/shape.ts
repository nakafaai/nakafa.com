import {
  ELEMENTS,
  ElementSchema,
} from "@repo/design-system/components/three/molecule/element";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  aside,
  ORIGIN,
  PointSchema,
  scale,
  sub,
} from "@repo/design-system/components/three/molecule/point";
import { Array as Arr, Match, Option, Schema } from "effect";

/**
 * How a molecule is drawn, as structural biology draws it: `sticks` is the
 * ball and stick model, `spheres` the space-filling model at van der Waals
 * radii, and `ribbon` a tube along each polymer's backbone with the rest as
 * thick sticks.
 */
export const StyleSchema = Schema.Literals(["ribbon", "spheres", "sticks"]);
export type Style = typeof StyleSchema.Type;

/**
 * One atom: where its nucleus is in angstrom, its element, the `part` of the
 * molecule it belongs to (a residue or a group, which a caller may tint or
 * label), and whether it is `spine`, the backbone a ribbon replaces.
 */
const AtomSchema = Schema.Struct({
  at: PointSchema,
  element: ElementSchema,
  part: Schema.Finite,
  spine: Schema.Boolean,
});
export type Atom = typeof AtomSchema.Type;

/** A covalent bond between two atoms by their index, single, double or triple. */
const BondSchema = Schema.Struct({
  from: Schema.Finite,
  order: Schema.Literals([1, 2, 3]),
  to: Schema.Finite,
});
export type Bond = typeof BondSchema.Type;

/**
 * A molecule as its real atoms and bonds, with the `ties` between them, the
 * hydrogen bonds that hold two strands or two molecules together, and the
 * `traces` a ribbon follows: the points along each polymer chain's backbone.
 */
export const MoleculeSchema = Schema.Struct({
  atoms: Schema.Array(AtomSchema),
  bonds: Schema.Array(BondSchema),
  ties: Schema.Array(Schema.Tuple([PointSchema, PointSchema])),
  traces: Schema.Array(Schema.Array(PointSchema)),
});
export type Molecule = typeof MoleculeSchema.Type;

/** A sphere to draw: an atom, or the joint of two thick sticks. */
const BallSchema = Schema.Struct({
  at: PointSchema,
  element: ElementSchema,
  part: Schema.Finite,
  radius: Schema.Finite,
});
export type Ball = typeof BallSchema.Type;

/** A cylinder to draw: half a bond, in the colour of the atom it starts at. */
const RodSchema = Schema.Struct({
  element: ElementSchema,
  from: PointSchema,
  part: Schema.Finite,
  radius: Schema.Finite,
  to: PointSchema,
});
export type Rod = typeof RodSchema.Type;

/** Everything one style draws of a molecule, in angstrom. */
const ShapeSchema = Schema.Struct({
  balls: Schema.Array(BallSchema),
  rods: Schema.Array(RodSchema),
  tubes: Schema.Array(Schema.Array(PointSchema)),
});
export type Shape = typeof ShapeSchema.Type;

/** A ball and stick atom is drawn at this share of its van der Waals radius. */
const BALL_SHARE = 0.27;

/** The radius of a single bond's rod, and of each rod of a multiple bond. */
const ROD = 0.14;
const THIN_ROD = 0.085;

/** How far the rods of a double bond stand from the line between the nuclei. */
const ROD_GAP = 0.19;

/** The radius of a ribbon model's thick sticks and of the joints between them. */
const THICK_ROD = 0.24;

/** The radius of the tube a ribbon draws along a backbone. */
export const TUBE = 0.8;

/** A hydrogen bond is drawn as this many small beads between its two atoms. */
const TIE_BEADS = [0.25, 0.5, 0.75] as const;
const TIE_BEAD = 0.1;

/** Where each rod of a bond of the given order stands, in rod gaps from its middle. */
const LANES = { 1: [0], 2: [-1, 1], 3: [-1.6, 0, 1.6] } as const;

/**
 * The spheres, cylinders and tubes that draw `molecule` in `style`. A double
 * bond is two rods side by side in the plane of its neighbours and a triple
 * bond three; every rod is cut at its middle so each half takes the colour of
 * its own atom.
 */
export function shapeOf(molecule: Molecule, style: Style): Shape {
  return Match.value(style).pipe(
    Match.when("spheres", () => ({
      balls: Arr.map(molecule.atoms, (atom) =>
        ballOf(atom, ELEMENTS[atom.element].reach)
      ),
      rods: [],
      tubes: [],
    })),
    Match.when("sticks", () => ({
      balls: [
        ...Arr.map(molecule.atoms, (atom) =>
          ballOf(atom, ELEMENTS[atom.element].reach * BALL_SHARE)
        ),
        ...beadsOf(molecule),
      ],
      rods: Arr.flatMap(molecule.bonds, (bond) =>
        rodsOf(molecule, bond, bond.order === 1 ? ROD : THIN_ROD)
      ),
      tubes: [],
    })),
    Match.when("ribbon", () => ({
      balls: [
        ...Arr.map(
          Arr.filter(molecule.atoms, (atom) => !atom.spine),
          (atom) => ballOf(atom, THICK_ROD)
        ),
        ...beadsOf(molecule),
      ],
      rods: Arr.flatMap(molecule.bonds, (bond) =>
        rodsOf(molecule, { ...bond, order: 1 }, THICK_ROD, true)
      ),
      tubes: Arr.map(molecule.traces, easedOf),
    })),
    Match.exhaustive
  );
}

/** The middle of the atoms of one `part`, for a label; the origin when it has none. */
export function centerOf(molecule: Molecule, part: number): Point {
  const atoms = Arr.filter(molecule.atoms, (atom) => atom.part === part);
  if (atoms.length === 0) {
    return ORIGIN;
  }
  return scale(
    Arr.reduce(atoms, ORIGIN, (sum, atom) => add(sum, atom.at)),
    1 / atoms.length
  );
}

/**
 * A backbone's trace with its zigzag from atom to atom eased out: every inner
 * point moves halfway to the middle of its two neighbours, so a ribbon's tube
 * sweeps along the chain.
 */
function easedOf(trace: readonly Point[]): readonly Point[] {
  return Arr.map(trace, (point, index) => {
    const before = trace[index - 1];
    const after = trace[index + 1];
    if (before === undefined || after === undefined) {
      return point;
    }
    return scale(add(scale(point, 2), add(before, after)), 0.25);
  });
}

/** The beads that dash each hydrogen bond, in hydrogen's white, belonging to no part. */
function beadsOf(molecule: Molecule): readonly Ball[] {
  return Arr.flatMap(molecule.ties, ([from, to]) =>
    Arr.map(TIE_BEADS, (share) => ({
      at: add(from, scale(sub(to, from), share)),
      element: "H" as const,
      part: -1,
      radius: TIE_BEAD,
    }))
  );
}

/** One atom as a sphere of the given radius. */
function ballOf(atom: Atom, radius: number): Ball {
  return { at: atom.at, element: atom.element, part: atom.part, radius };
}

/**
 * The half rods of one bond. A bond that names a missing atom draws nothing,
 * and with `bare` a bond that touches the spine draws nothing either.
 */
function rodsOf(
  molecule: Molecule,
  bond: Bond,
  radius: number,
  bare = false
): readonly Rod[] {
  return Option.match(
    Option.all([
      Arr.get(molecule.atoms, bond.from),
      Arr.get(molecule.atoms, bond.to),
    ]),
    {
      onNone: () => [],
      onSome: ([from, to]) => {
        if (bare && (from.spine || to.spine)) {
          return [];
        }
        const side =
          bond.order === 1
            ? ORIGIN
            : aside(sub(to.at, from.at), leanOf(molecule, bond));
        return Arr.flatMap(LANES[bond.order], (lane) => {
          const shift = scale(side, lane * ROD_GAP);
          const start = add(from.at, shift);
          const end = add(to.at, shift);
          const middle = scale(add(start, end), 0.5);
          return [
            {
              element: from.element,
              from: start,
              part: from.part,
              radius,
              to: middle,
            },
            {
              element: to.element,
              from: middle,
              part: to.part,
              radius,
              to: end,
            },
          ];
        });
      },
    }
  );
}

/**
 * The direction from one end of `bond` to a neighbouring atom, which sets the
 * plane a multiple bond's rods lie in; no direction when it has no neighbour.
 */
function leanOf(molecule: Molecule, bond: Bond): Point {
  const arms = Arr.flatMap([bond.from, bond.to], (anchor) =>
    Arr.flatMap(molecule.bonds, (other) => {
      if (other === bond || (other.from !== anchor && other.to !== anchor)) {
        return [];
      }
      const far = other.from === anchor ? other.to : other.from;
      return Option.match(
        Option.all([
          Arr.get(molecule.atoms, anchor),
          Arr.get(molecule.atoms, far),
        ]),
        { onNone: () => [], onSome: ([near, next]) => [sub(next.at, near.at)] }
      );
    })
  );
  return Option.getOrElse(Arr.head(arms), (): Point => [0, 0, 0]);
}
