import { ElementSchema } from "@repo/design-system/components/three/molecule/element";
import type {
  Link,
  Named,
} from "@repo/design-system/components/three/molecule/nucleic";
import {
  add,
  grown,
  scale,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import {
  at,
  built,
  named,
} from "@repo/design-system/components/three/molecule/small";
import { Array as Arr, Schema } from "effect";

/** The two lipids of the lesson: a fat, and the lipid membranes are made of. */
const KindSchema = Schema.Literals(["phospholipid", "triglyceride"]);
type Kind = typeof KindSchema.Type;

/**
 * One atom by its internal coordinates: its name and element, the atom it is
 * bonded to, the atom before that and the one its torsion is measured from,
 * then the bond length in angstrom, the bond angle and the torsion in
 * degrees.
 */
const RowSchema = Schema.Tuple([
  Schema.String,
  ElementSchema,
  Schema.String,
  Schema.String,
  Schema.String,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
type Row = typeof RowSchema.Type;

/**
 * The torsions that set how one fatty acid hangs, in degrees: about the
 * glycerol bond that carries its oxygen, about the bond from glycerol to
 * that oxygen, and about the first two bonds of the chain past its ester.
 */
const HangSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
type Hang = typeof HangSchema.Type;

/** A fatty acid of the lesson has eighteen carbons: stearic acid, or oleic acid with its cis double bond after carbon nine. */
const CARBONS = 18;
const CIS = 9;

/** How far the last carbon of a tail stays from the middle of a bilayer, in angstrom. */
const GAP = 1.9;

/** How far the bonds beside the cis double bond are turned out of its plane, in degrees. */
const SKEW = 120;

/**
 * Glycerol's three carbons in angstrom, turned so that the tails of each
 * lipid hang straight down, and the torsions of its three arms in degrees.
 * Every torsion is staggered and no two atoms four or more bonds apart come
 * closer than they do in a crystal. The middle carbon of the membrane lipid
 * has the R configuration of the natural one.
 */
const FRAMES = {
  phospholipid: {
    glycerol: [
      named("G1", "C", [-1.408, 0.056, -0.595]),
      named("G2", "C", [0, 0, 0]),
      named("G3", "C", [0.31, 1.231, 0.854]),
    ],
    hangs: [
      [180, 180, 60, 180],
      [-120, 180, -60, -60],
      [60, 180, 60, -60],
    ],
  },
  triglyceride: {
    glycerol: [
      named("G1", "C", [-0.203, 1.174, -0.96]),
      named("G2", "C", [0, 0, 0]),
      named("G3", "C", [1.383, 0.028, 0.653]),
    ],
    hangs: [
      [180, 60, 60, 60],
      [-120, 180, 180, 180],
      [-60, 180, -60, -60],
    ],
  },
} as const satisfies Record<
  Kind,
  { glycerol: readonly Named[]; hangs: readonly [Hang, Hang, Hang] }
>;

/** The bond length, the angle at the carbon before and the torsion that put carbon `carbon` of a chain in place. */
function stepOf(carbon: number, cis: boolean) {
  if (!cis) {
    return [1.53, 112, 180] as const;
  }
  if (carbon === CIS + 1) {
    return [1.34, 124, SKEW] as const;
  }
  if (carbon === CIS + 2) {
    return [1.5, 124, 0] as const;
  }
  return [1.53, 112, carbon === CIS + 3 ? SKEW : 180] as const;
}

/**
 * One fatty acid on the oxygen `oxygen`, which hangs on glycerol carbon
 * `carbon` beside `beside`: the oxygen, the planar ester it makes with the
 * carboxyl carbon, and the chain, all trans but for the kink of a `cis`
 * chain. `tag` marks the atoms of this chain.
 */
function chainOf(
  tag: string,
  [oxygen, carbon, beside, from]: readonly [string, string, string, string],
  [swing, reach, bend, turn]: Hang,
  cis: boolean
) {
  const name = (index: number) => `C${index}${tag}`;
  return {
    links: [
      [carbon, oxygen, 1],
      [oxygen, name(1), 1],
      [name(1), `O${tag}`, 2],
      ...Arr.makeBy(
        CARBONS - 1,
        (index): Link => [
          name(index + 1),
          name(index + 2),
          cis && index + 1 === CIS ? 2 : 1,
        ]
      ),
    ] as const satisfies readonly Link[],
    rows: [
      [oxygen, "O", carbon, beside, from, 1.43, 109.5, swing],
      [name(1), "C", oxygen, carbon, beside, 1.34, 117, reach],
      [`O${tag}`, "O", name(1), oxygen, carbon, 1.21, 123, 0],
      [name(2), "C", name(1), oxygen, carbon, 1.51, 111, 180],
      [name(3), "C", name(2), name(1), oxygen, 1.53, 112, bend],
      [name(4), "C", name(3), name(2), name(1), 1.53, 112, turn],
      ...Arr.makeBy(
        CARBONS - 4,
        (index): Row => [
          name(index + 5),
          "C",
          name(index + 4),
          name(index + 3),
          name(index + 2),
          ...stepOf(index + 5, cis),
        ]
      ),
    ] as const satisfies readonly Row[],
  };
}

/**
 * The head of phosphatidylcholine on glycerol's third carbon: its oxygen, a
 * phosphate, and on it choline, two carbons and a nitrogen that carries
 * three methyl groups. The phosphate is drawn protonated, as the other
 * phosphates of this module are. The torsions, in degrees, are about the bonds
 * from glycerol out to the phosphorus and on to choline.
 */
function headOf([swing, reach, bend, turn]: Hang) {
  return {
    links: [
      ["G3", "OG3", 1],
      ["OG3", "PH", 1],
      ["PH", "O1H", 2],
      ["PH", "O2H", 1],
      ["PH", "O3H", 1],
      ["O3H", "CH1", 1],
      ["CH1", "CH2", 1],
      ["CH2", "NH", 1],
      ["NH", "CM1", 1],
      ["NH", "CM2", 1],
      ["NH", "CM3", 1],
    ] as const satisfies readonly Link[],
    rows: [
      ["OG3", "O", "G3", "G2", "G1", 1.43, 109.5, swing],
      ["PH", "P", "OG3", "G3", "G2", 1.6, 119, reach],
      ["O3H", "O", "PH", "OG3", "G3", 1.6, 104, bend],
      ["O1H", "O", "PH", "OG3", "G3", 1.48, 109.5, bend + 120],
      ["O2H", "O", "PH", "OG3", "G3", 1.48, 109.5, bend - 120],
      ["CH1", "C", "O3H", "PH", "OG3", 1.43, 119, turn],
      ["CH2", "C", "CH1", "O3H", "PH", 1.53, 109.5, 180],
      ["NH", "N", "CH2", "CH1", "O3H", 1.5, 115, 70],
      ["CM1", "C", "NH", "CH2", "CH1", 1.5, 109.5, 60],
      ["CM2", "C", "NH", "CH2", "CH1", 1.5, 109.5, 180],
      ["CM3", "C", "NH", "CH2", "CH1", 1.5, 109.5, -60],
    ] as const satisfies readonly Row[],
  };
}

/** Which part an atom of a lipid belongs to, by its name: glycerol and its oxygens 0, the three chains 1 to 3, the head 4. */
function partOf(name: string) {
  if (name.includes("G")) {
    return 0;
  }
  if (name.endsWith("A")) {
    return 1;
  }
  if (name.endsWith("B")) {
    return 2;
  }
  return name.endsWith("C") ? 3 : 4;
}

/** The named atoms the rows of internal coordinates put on glycerol, in angstrom. */
function grownOf(glycerol: readonly Named[], rows: readonly Row[]) {
  const turn = Math.PI / 180;
  return Arr.reduce(
    rows,
    glycerol,
    (atoms, [name, element, bonded, before, first, length, angle, torsion]) => [
      ...atoms,
      named(
        name,
        element,
        grown(
          at(atoms, bonded),
          at(atoms, before),
          at(atoms, first),
          length,
          angle * turn,
          torsion * turn
        )
      ),
    ]
  );
}

/**
 * One lipid with every atom, in angstrom, the middle carbon of its glycerol
 * at the origin and its tails hanging down: a triglyceride, glycerol with a
 * fatty acid on each of its three oxygens, or phosphatidylcholine, with two
 * fatty acids and a phosphate and choline head standing up from the third.
 * Each fatty acid joins glycerol through an ester bond. In an `unsaturated`
 * lipid the last fatty acid is oleic acid, kinked at its cis double bond;
 * the others are stearic acid. Glycerol and its oxygens are part 0, the
 * fatty acids parts 1 to 3 and the head part 4. It comes with the middle of
 * one ester bond and of the bond after the last fatty acid's ninth carbon,
 * where an unsaturated one kinks, for their labels.
 */
export function lipidOf(kind: Kind, unsaturated: boolean) {
  const fat = kind === "triglyceride";
  const {
    glycerol,
    hangs: [first, second, third],
  } = FRAMES[kind];
  const arms = [
    chainOf("A", ["OG1", "G1", "G2", "G3"], first, false),
    chainOf("B", ["OG2", "G2", "G1", "G3"], second, unsaturated && !fat),
    fat
      ? chainOf("C", ["OG3", "G3", "G2", "G1"], third, unsaturated)
      : headOf(third),
  ];
  const atoms = grownOf(
    glycerol,
    Arr.flatMap(arms, (arm): readonly Row[] => arm.rows)
  );
  const kinked = fat ? "C" : "B";
  return {
    ester: scale(add(at(atoms, "OG1"), at(atoms, "C1A")), 0.5),
    kink: scale(
      add(at(atoms, `C${CIS}${kinked}`), at(atoms, `C${CIS + 1}${kinked}`)),
      0.5
    ),
    molecule: built(
      atoms,
      [
        ["G1", "G2", 1],
        ["G2", "G3", 1],
        ...Arr.flatMap(arms, (arm): readonly Link[] => arm.links),
      ],
      partOf
    ),
  };
}

/**
 * A stretch of bilayer as its lipids' heavy atoms, in angstrom: `count`
 * phospholipids in each leaflet side by side along x, `spacing` apart, heads
 * out and tails in, the lower leaflet turned over. Their hydrogens and bonds
 * are left out, since a space-filling model of a membrane shows neither.
 */
export function bilayerOf(
  unsaturated: boolean,
  count: number,
  spacing: number
): Molecule {
  const lipid = lipidOf("phospholipid", unsaturated).molecule;
  const heavy = Arr.filter(lipid.atoms, (atom) => atom.element !== "H");
  const reach = Arr.reduce(heavy, 0, (low, atom) => Math.min(low, atom.at[1]));
  return {
    atoms: Arr.flatMap([1, -1] as const, (leaflet) =>
      Arr.flatMap(Arr.range(0, count - 1), (index) => {
        const x = (index - (count - 1) / 2) * spacing;
        const turned = (index % 2) * 2 - 1;
        return Arr.map(heavy, (atom) => ({
          ...atom,
          at: [
            x + atom.at[0] * leaflet * turned,
            (atom.at[1] - reach + GAP) * leaflet,
            atom.at[2] * turned,
          ] as const,
        }));
      })
    ),
    bonds: [],
    ties: [],
    traces: [],
  };
}
