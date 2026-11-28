import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  ORIGIN,
  scale,
  sub,
} from "@repo/design-system/components/three/molecule/point";
import { saturate } from "@repo/design-system/components/three/molecule/saturate";
import type {
  Bond,
  Molecule,
} from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Match, Schema } from "effect";

const IsomerCompoundSchema = Schema.Literals([
  "butane",
  "methylpropane",
  "but1ene",
  "but2ene",
]);

export type IsomerCompound = typeof IsomerCompoundSchema.Type;

/**
 * Bond lengths in angstrom (CRC Handbook, 97th edition): a carbon-carbon
 * single bond, the shorter single bond beside a double bond, and the double
 * bond itself.
 */
const SINGLE = 1.53;
const BESIDE = 1.5;
const DOUBLE = 1.34;

/** The C-C-C angle at a saturated carbon and at a doubly bonded one, in radians. */
const SATURATED = (112 * Math.PI) / 180;
const FLAT = (124 * Math.PI) / 180;

/** The angle between two bonds of a tetrahedral carbon, in radians. */
const TETRAHEDRAL = Math.acos(-1 / 3);

/**
 * The carbons of an unbranched chain as a flat zigzag: bonds of the given
 * `lengths` from the first carbon on, bending by the given `angles` at each
 * carbon between two bonds, to one side and then the other.
 */
function zigzag(
  lengths: readonly number[],
  angles: readonly number[]
): readonly Point[] {
  return Arr.reduce(
    lengths,
    { at: ORIGIN, carbons: [ORIGIN], heading: 0 },
    ({ at, carbons, heading }, reach, index) => {
      const turn =
        index === 0
          ? 0
          : (Math.PI - Number(angles[index - 1])) * (index % 2 === 1 ? 1 : -1);
      const next = heading + turn;
      const carbon = add(at, [
        Math.cos(next) * reach,
        Math.sin(next) * reach,
        0,
      ]);
      return { at: carbon, carbons: [...carbons, carbon], heading: next };
    }
  ).carbons;
}

/** The carbons of 2-methylpropane: three methyl carbons at three corners of the middle carbon's tetrahedron. */
function branched(): readonly Point[] {
  const flat = Math.sin(TETRAHEDRAL);
  return [
    ORIGIN,
    ...Arr.makeBy(3, (corner): Point => {
      const around = (corner / 3) * Math.PI * 2;
      return [
        Math.cos(around) * flat * SINGLE,
        Math.cos(TETRAHEDRAL) * SINGLE,
        Math.sin(around) * flat * SINGLE,
      ];
    }),
  ];
}

/** Each isomer's carbons and the bonds between them. */
function skeletonOf(compound: IsomerCompound) {
  return Match.value(compound).pipe(
    Match.when("butane", () => ({
      bonds: chain([1, 1, 1]),
      carbons: zigzag([SINGLE, SINGLE, SINGLE], [SATURATED, SATURATED]),
    })),
    Match.when("methylpropane", () => ({
      bonds: Arr.makeBy(3, (corner): Bond => ({
        from: 0,
        order: 1,
        to: corner + 1,
      })),
      carbons: branched(),
    })),
    Match.when("but1ene", () => ({
      bonds: chain([2, 1, 1]),
      carbons: zigzag([DOUBLE, BESIDE, SINGLE], [FLAT, SATURATED]),
    })),
    Match.when("but2ene", () => ({
      bonds: chain([1, 2, 1]),
      carbons: zigzag([BESIDE, DOUBLE, BESIDE], [FLAT, FLAT]),
    })),
    Match.exhaustive
  );
}

/** The bonds of an unbranched chain with the given orders, from its first carbon on. */
function chain(orders: readonly Bond["order"][]): readonly Bond[] {
  return Arr.map(orders, (order, index) => ({
    from: index,
    order,
    to: index + 1,
  }));
}

/** Whether the isomer has a carbon-carbon double bond, which bromine water adds across. */
export function isUnsaturated(compound: IsomerCompound) {
  return Arr.some(skeletonOf(compound).bonds, (bond) => bond.order === 2);
}

/**
 * One C4 isomer as its real atoms and bonds, in angstrom and centred on its
 * carbons: butane and 2-methylpropane (C4H10), but-1-ene and trans-but-2-ene
 * (C4H8), each with every hydrogen where its carbon's geometry puts it.
 */
export function moleculeOf(compound: IsomerCompound): Molecule {
  const { bonds, carbons } = skeletonOf(compound);
  const middle = scale(
    Arr.reduce(carbons, ORIGIN, (sum, carbon) => add(sum, carbon)),
    1 / carbons.length
  );
  return saturate({
    atoms: Arr.map(carbons, (carbon) => ({
      at: sub(carbon, middle),
      element: "C" as const,
      part: 0,
      spine: false,
    })),
    bonds,
    ties: [],
    traces: [],
  });
}
