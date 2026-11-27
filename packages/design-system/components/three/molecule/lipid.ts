import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { ElementSchema } from "@repo/design-system/components/three/molecule/element";
import type {
  Link,
  Named,
} from "@repo/design-system/components/three/molecule/nucleic";
import { NamedSchema } from "@repo/design-system/components/three/molecule/nucleic";
import {
  add,
  grown,
  ORIGIN,
  PointSchema,
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

/** How one lipid is built: where glycerol's three carbons stand and how its three arms hang. */
const FrameSchema = Schema.Struct({
  glycerol: Schema.Array(NamedSchema),
  hangs: Schema.Tuple([HangSchema, HangSchema, HangSchema]),
});

/** A fatty acid of the lesson has eighteen carbons: stearic acid, or oleic acid with its cis double bond after carbon nine. */
const CARBONS = 18;
const CIS = 9;

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
} as const satisfies Record<Kind, typeof FrameSchema.Type>;

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
 * Where one lipid of a crowd stands: the place of its glycerol end, its turn
 * about its long axis and its lean from upright in radians, and whether it
 * is turned over so its tails point up.
 */
const SeatSchema = Schema.Struct({
  at: PointSchema,
  lean: Schema.Finite,
  over: Schema.Boolean,
  spin: Schema.Finite,
});
type Seat = typeof SeatSchema.Type;

/**
 * Many copies of one lipid as their heavy atoms, one at each seat. The lipid
 * is first moved so its long axis runs down from the origin through the
 * middle of its tails. Hydrogens and bonds are left out, since a
 * space-filling model of a crowd shows neither.
 */
function crowdOf(lipid: Molecule, seats: readonly Seat[]): Molecule {
  const heavy = Arr.filter(lipid.atoms, (atom) => atom.element !== "H");
  const tails = Arr.filter(heavy, (atom) => atom.part >= 1 && atom.part <= 3);
  const middle = scale(
    Arr.reduce(tails, ORIGIN, (sum, atom) => add(sum, atom.at)),
    1 / tails.length
  );
  return {
    atoms: Arr.flatMap(seats, (seat) => {
      const flip = seat.over ? -1 : 1;
      return Arr.map(heavy, (atom) => {
        const x = atom.at[0] - middle[0];
        const z = atom.at[2] - middle[2];
        const across = x * Math.cos(seat.spin) + z * Math.sin(seat.spin);
        const along = atom.at[1];
        return {
          ...atom,
          at: add(seat.at, [
            (across * Math.cos(seat.lean) - along * Math.sin(seat.lean)) * flip,
            (across * Math.sin(seat.lean) + along * Math.cos(seat.lean)) * flip,
            z * Math.cos(seat.spin) - x * Math.sin(seat.spin),
          ]),
        };
      });
    }),
    bonds: [],
    ties: [],
    traces: [],
  };
}

/**
 * How the lipids of a crowd stand: how far apart across and along their
 * rows in angstrom, every other row shifted half a place so the tails of
 * one fill the gaps of the next, how far the tail ends stay from the middle
 * where two layers meet, how far the lower layer is moved aside so the
 * uneven tails of a fat reach past it into the gaps of the upper one, and
 * how far each lipid strays from its seat.
 * Straight saturated tails let the lipids stand close and in order, with no
 * two atoms of neighbours nearer than 3.5 angstrom; a kinked tail takes more
 * room, and its lipids turn, lean and ride up and down as in a liquid.
 */
function packingOf(kind: Kind, unsaturated: boolean) {
  const fat = kind === "triglyceride";
  return unsaturated
    ? {
        across: fat ? 19.6 : 15.4,
        along: fat ? 8.6 : 6.2,
        gap: fat ? -3.4 : 0.8,
        lean: 0.05,
        offset: fat ? ([2.8, 0] as const) : ([0, 0] as const),
        ride: 1,
        spin: 0.12,
      }
    : {
        across: fat ? 12.6 : 19.4,
        along: fat ? 6.6 : 3.6,
        gap: fat ? -0.4 : 0.8,
        lean: 0,
        offset: fat ? ([2.1, 3.3] as const) : ([0, 0] as const),
        ride: 0,
        spin: 0,
      };
}

/**
 * Where the lipid in `column` and `row` of one layer of a crowd stands, the
 * layer above the middle for a `layer` of 1 and turned over below it for -1.
 * `index` tells the lipids of a crowd apart and `reach` is how far the tails
 * hang below glycerol.
 */
function seatOf(
  packing: ReturnType<typeof packingOf>,
  [column, row, layer]: readonly [number, number, number],
  index: number,
  reach: number
): Seat {
  const aside = layer === -1 ? packing.offset : NONE;
  return {
    at: [
      (column + (Math.abs(row) % 2) / 2 - 0.25) * packing.across + aside[0],
      (packing.gap + reach + strayOf(index, 1) * packing.ride) * layer,
      row * packing.along + aside[1],
    ],
    lean: strayOf(index, 2) * packing.lean,
    over: layer === -1,
    spin: strayOf(index, 3) * packing.spin,
  };
}

/** How far the lowest heavy atom of a lipid hangs below its glycerol, in angstrom. */
function reachOf(lipid: Molecule) {
  return -Arr.reduce(lipid.atoms, 0, (low, atom) =>
    atom.element === "H" ? low : Math.min(low, atom.at[1])
  );
}

/** The offset of a layer that is not moved aside. */
const NONE = [0, 0] as const;

/** A number from -1 to 1 that seat `index` of a crowd always gets for its `trait`. */
function strayOf(index: number, trait: number) {
  return chanceAt(index, trait, 11) * 2 - 1;
}

/**
 * A patch of bilayer as its lipids' heavy atoms, in angstrom: two leaflets of
 * `columns` by `rows` phospholipids, heads out toward the water and tails in,
 * the lower leaflet turned over, each standing as its tails let it.
 */
export function bilayerOf(
  unsaturated: boolean,
  columns: number,
  rows: number
): Molecule {
  const lipid = lipidOf("phospholipid", unsaturated).molecule;
  const packing = packingOf("phospholipid", unsaturated);
  const reach = reachOf(lipid);
  return crowdOf(
    lipid,
    Arr.flatMap([1, -1] as const, (layer) =>
      Arr.flatMap(Arr.range(0, rows - 1), (row) =>
        Arr.map(Arr.range(0, columns - 1), (column) =>
          seatOf(
            packing,
            [column - (columns - 1) / 2, row - Math.floor(rows / 2), layer],
            (layer + 1) * 500 + row * columns + column,
            reach
          )
        )
      )
    )
  );
}

/** How far the columns and rows of a fat droplet reach from its middle, in places. */
const DROPLET = [1, 2] as const;

/**
 * A droplet of fat in water as its triglycerides' heavy atoms, in angstrom:
 * the molecules that fit an oval clump, in two layers that meet tail to
 * tail, so nothing but glycerol and ester oxygens faces the water. A
 * saturated fat stacks into the ordered clump of a solid; the kinked tails
 * of an unsaturated one hold the molecules apart and askew, as in an oil.
 */
export function dropletOf(unsaturated: boolean): Molecule {
  const lipid = lipidOf("triglyceride", unsaturated).molecule;
  const packing = packingOf("triglyceride", unsaturated);
  const reach = reachOf(lipid);
  const [columns, rows] = DROPLET;
  const places = Arr.flatMap([1, -1] as const, (layer) =>
    Arr.flatMap(Arr.range(-columns, columns), (column) =>
      Arr.map(Arr.range(-rows, rows), (row) => [column, row, layer] as const)
    )
  );
  return crowdOf(
    lipid,
    Arr.map(
      Arr.filter(
        places,
        ([column, row]) =>
          (column / (columns + 0.4)) ** 2 + (row / (rows + 0.4)) ** 2 <= 1
      ),
      (place, index) => seatOf(packing, place, index, reach)
    )
  );
}
