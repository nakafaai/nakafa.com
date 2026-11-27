import type { Molecule as Kind } from "@repo/design-system/components/contents/biology/lipid/packing";
import {
  bilayerOf,
  dropletOf,
  lipidOf,
} from "@repo/design-system/components/three/molecule/lipid";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import { PointSchema } from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import { centerOf } from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Order, Schema } from "effect";

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

/** One label of the scene: the part it names and where it stands in scene units. */
const MarkSchema = Schema.Struct({
  at: PointSchema,
  part: PartSchema,
});
type Mark = typeof MarkSchema.Type;

/** A label before it is placed: the part it names and the height of that part on the molecule, in angstrom. */
const NoteSchema = Schema.Struct({
  height: Schema.Finite,
  part: PartSchema,
});
type Note = typeof NoteSchema.Type;

/** The height a crowd is centred on and the camera first looks at, in scene units. */
export const MIDDLE = 0.72;

/** How large one angstrom of a lone lipid and of a crowd is drawn, in scene units. */
const LONE = 0.039;
const CROWD = 0.0155;

/** How far above the floor a lone lipid's lowest atom hangs, in scene units. */
const FOOT = 0.08;

/**
 * How far a label stands from the outermost atom, how near its height an
 * atom must be to count as beside it, how far apart two labels are kept so
 * neither covers the other, and how far past an atom's middle the atom
 * reaches, all in angstrom.
 */
const MARGIN = 1.6;
const NEAR = 1.6;
const APART = 3.4;
const REACH = 1.2;

/** What stands above the top label of a column: nothing, at any height. */
const TOP: Note = { height: Number.POSITIVE_INFINITY, part: "glycerol" };

/** How far below the middle of a fatty acid its label stands, in angstrom, clear of the kink an unsaturated one has there. */
const BELOW = 6;

/** The box that holds every atom of a molecule, in angstrom, for the camera to frame. */
function boundsOf(molecule: Molecule) {
  const range = (axis: 0 | 1 | 2) => {
    const places = Arr.map(molecule.atoms, (atom) => atom.at[axis]);
    return {
      max: Math.max(...places) + REACH,
      min: Math.min(...places) - REACH,
    };
  };
  return { x: range(0), y: range(1), z: range(2) };
}

/**
 * The heights of a column of labels, from the top one down: each as high as
 * its part, or lower when the label above would otherwise cover it.
 */
function spacedOf(notes: readonly Note[]): readonly Note[] {
  const down = Arr.sort(
    notes,
    Order.mapInput(Order.flip(Order.Number), (note: Note) => note.height)
  );
  return Arr.drop(
    Arr.scan(
      down,
      TOP,
      (above, note): Note => ({
        height: Math.min(note.height, above.height - APART),
        part: note.part,
      })
    ),
    1
  );
}

/**
 * A lone lipid laid out for the camera to frame: its atoms, how large one
 * angstrom of it is drawn, where the middle carbon of its glycerol stands
 * in scene units, the box of its atoms in angstrom, and its labels. The
 * labels stand in a column on its right, each beside the atoms at its own
 * height and as level with the part it names as the label above lets it be:
 * the phosphate group of a membrane lipid, glycerol, an ester bond, the kink
 * of an unsaturated tail and a fatty acid.
 */
export function layoutOf(kind: Kind, unsaturated: boolean) {
  const { ester, kink, molecule } = lipidOf(kind, unsaturated);
  const bounds = boundsOf(molecule);
  const stand: Point = [
    (-(bounds.x.min + bounds.x.max) / 2) * LONE,
    FOOT - (bounds.y.min + REACH) * LONE,
    0,
  ];
  const notes = spacedOf([
    ...Arr.map(
      Arr.filter(molecule.atoms, (atom) => atom.element === "P"),
      (atom): Note => ({ height: atom.at[1] + 1, part: "phosphate" })
    ),
    { height: centerOf(molecule, 0)[1] + 0.5, part: "glycerol" },
    { height: ester[1], part: "ester" },
    ...(unsaturated ? [{ height: kink[1], part: "kink" } as const] : []),
    { height: centerOf(molecule, 1)[1] - BELOW, part: "fatty" },
  ]);
  return {
    bounds,
    marks: Arr.map(notes, (note): Mark => {
      const beside = Arr.map(
        Arr.filter(
          molecule.atoms,
          (atom) => Math.abs(atom.at[1] - note.height) < NEAR
        ),
        (atom) => atom.at[0]
      );
      return {
        at: [
          stand[0] + (Math.max(...beside) + MARGIN) * LONE,
          stand[1] + note.height * LONE,
          0,
        ],
        part: note.part,
      };
    }),
    molecule,
    scale: LONE,
    stand,
  };
}

/**
 * Many lipids in water laid out for the camera to frame: the heavy atoms of
 * a clump of fat or of a patch of bilayer, how large one angstrom is drawn,
 * where the middle of the crowd stands in scene units, the box of its atoms
 * in angstrom, and its labels. A bilayer names the hydrophilic heads of its
 * upper leaflet and the hydrophobic tails below them on its right; a clump
 * of fat has no labels.
 */
export function crowdOf(kind: Kind, unsaturated: boolean) {
  const fat = kind === "triglyceride";
  const molecule = fat
    ? dropletOf(unsaturated)
    : bilayerOf(unsaturated, unsaturated ? 4 : 3, unsaturated ? 4 : 6);
  const bounds = boundsOf(molecule);
  const mark = (part: Mark["part"], height: number): Mark => ({
    at: [(bounds.x.max + MARGIN) * CROWD, MIDDLE + height * CROWD, 0],
    part,
  });
  return {
    bounds,
    marks: fat ? [] : [mark("head", 27), mark("tail", 12)],
    molecule,
    scale: CROWD,
    stand: [0, MIDDLE, 0] as const,
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
