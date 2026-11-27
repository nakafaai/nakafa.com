import type { Molecule as Kind } from "@repo/design-system/components/contents/biology/lipid/packing";
import {
  bilayerOf,
  dropletOf,
  lipidOf,
} from "@repo/design-system/components/three/molecule/lipid";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import { PointSchema } from "@repo/design-system/components/three/molecule/point";
import { centerOf } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Schema } from "effect";

/** The parts of a lipid the lab names. */
const PartSchema = Schema.Literals([
  "ester",
  "fatty",
  "glycerol",
  "head",
  "kink",
  "phosphate",
  "tail",
]);

/** One label of the scene: the part it names, where it stands in scene units and the side of the subject it is on. */
const MarkSchema = Schema.Struct({
  at: PointSchema,
  part: PartSchema,
  side: Schema.Literals(["left", "right"]),
});
type Mark = typeof MarkSchema.Type;

/** The height the camera looks at and a crowd is centred on, in scene units. */
export const MIDDLE = 0.72;

/** How far above the floor a lone lipid's lowest atom hangs, in scene units. */
const FOOT = 0.08;

/** How far a label stands from the outermost atom, in angstrom, and how near its height an atom must be to count. */
const MARGIN = 1.6;
const NEAR = 2.5;

/**
 * Where a lone lipid stands across the frame, in scene units: the middle
 * carbon of its glycerol a little left of the middle of a wide frame, and
 * its leftmost atom near the left edge of a narrow one.
 */
const SHIFT = -0.22;
const LEFT = -1.06;

/**
 * How the scene is framed: where the camera stands, how large one angstrom
 * of a lone lipid and of a crowd is drawn in scene units, and how far a
 * crowd with labels is moved aside. A narrow frame steps back and moves the
 * subject left, so every label fits on its right.
 */
export function frameOf(narrow: boolean) {
  return narrow
    ? {
        aside: -0.5,
        camera: [0, 0.9, 3.1] as const,
        crowd: 0.0145,
        molecule: 0.036,
      }
    : {
        aside: -0.2,
        camera: [0, 0.9, 2.18] as const,
        crowd: 0.0155,
        molecule: 0.039,
      };
}

/**
 * A lone lipid laid out in the frame: its atoms, how large one angstrom of
 * it is drawn, where the middle carbon of its glycerol stands in scene
 * units, and its labels. In a wide frame the ester bond, the fatty acid and
 * the phosphate group are named on its left, and glycerol and the kink of an
 * unsaturated tail on its right, each level with its part and beside the
 * atoms at that height. In a narrow frame all stand in one column on the
 * right of the whole molecule, nudged apart so none covers another.
 */
export function layoutOf(kind: Kind, unsaturated: boolean, narrow: boolean) {
  const { ester, kink, molecule } = lipidOf(kind, unsaturated);
  const scale = frameOf(narrow).molecule;
  const leftmost = Math.min(...Arr.map(molecule.atoms, (atom) => atom.at[0]));
  const lowest = Math.min(...Arr.map(molecule.atoms, (atom) => atom.at[1]));
  const stand: Point = [
    narrow ? LEFT - leftmost * scale : SHIFT,
    FOOT - lowest * scale,
    0,
  ];
  const edgeOf = (side: Mark["side"], height: number) => {
    const sides = Arr.map(
      Arr.filter(
        molecule.atoms,
        (atom) => narrow || Math.abs(atom.at[1] - height) < NEAR
      ),
      (atom) => atom.at[0]
    );
    return side === "left"
      ? Math.min(...sides) - MARGIN
      : Math.max(...sides) + MARGIN;
  };
  const mark = (
    part: Mark["part"],
    wide: Mark["side"],
    height: number,
    nudge: number
  ): Mark => {
    const side = narrow ? "right" : wide;
    return {
      at: [
        stand[0] + edgeOf(side, height) * scale,
        stand[1] + (height + (narrow ? nudge : 0)) * scale,
        0,
      ],
      part,
      side,
    };
  };
  return {
    marks: [
      mark("glycerol", "right", centerOf(molecule, 0)[1] + 0.5, 0.5),
      mark("ester", "left", ester[1], -4),
      mark("fatty", "left", centerOf(molecule, 1)[1], -7),
      ...Arr.map(
        Arr.filter(molecule.atoms, (atom) => atom.element === "P"),
        (atom) => mark("phosphate", "left", atom.at[1] + 1, 2.5)
      ),
      ...(unsaturated ? [mark("kink", "right", kink[1], 0)] : []),
    ],
    molecule,
    scale,
    stand,
  };
}

/**
 * Many lipids in water laid out in the frame: the heavy atoms of a droplet
 * of fat or of a patch of bilayer, how large one angstrom is drawn, where
 * the middle of the crowd stands in scene units, and its labels. A bilayer
 * names the hydrophilic heads of its upper leaflet and the hydrophobic tails
 * below them on its right, and is moved aside to make room for them; a
 * droplet has no labels and stands in the middle.
 */
export function crowdOf(kind: Kind, unsaturated: boolean, narrow: boolean) {
  const frame = frameOf(narrow);
  if (kind === "triglyceride") {
    return {
      marks: [],
      molecule: dropletOf(unsaturated),
      scale: frame.crowd,
      stand: [0, MIDDLE, 0] as const,
    };
  }
  const molecule = bilayerOf(
    unsaturated,
    unsaturated ? 4 : 3,
    unsaturated ? 4 : 6
  );
  const reach =
    Math.max(...Arr.map(molecule.atoms, (atom) => atom.at[0])) + MARGIN * 2;
  const mark = (part: Mark["part"], height: number): Mark => ({
    at: [frame.aside + reach * frame.crowd, MIDDLE + height * frame.crowd, 0],
    part,
    side: "right",
  });
  return {
    marks: [mark("head", 27), mark("tail", 12)],
    molecule,
    scale: frame.crowd,
    stand: [frame.aside, MIDDLE, 0] as const,
  };
}

/**
 * Where the water around a crowd gathers, in angstrom from its middle:
 * above and below a bilayer, whose heads face it, and all around a droplet.
 */
export function poolsOf(kind: Kind): readonly Point[] {
  return kind === "triglyceride"
    ? [
        [-40, 20, -6],
        [-40, -18, -4],
        [40, 18, -6],
        [40, -20, -4],
        [-6, 44, -8],
        [8, -44, -8],
      ]
    : [
        [-22, 44, 0],
        [0, 45, -4],
        [22, 44, 0],
        [-22, -44, 0],
        [0, -45, -4],
        [22, -44, 0],
      ];
}
