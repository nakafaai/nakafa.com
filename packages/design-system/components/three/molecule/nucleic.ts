import { ElementSchema } from "@repo/design-system/components/three/molecule/element";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  screw,
} from "@repo/design-system/components/three/molecule/point";
import { saturate } from "@repo/design-system/components/three/molecule/saturate";
import type {
  Bond,
  Molecule,
} from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Option, Schema } from "effect";

/** The bases of DNA and RNA. */
export const BaseSchema = Schema.Literals(["A", "C", "G", "T", "U"]);
export type Base = typeof BaseSchema.Type;

/** DNA is built on deoxyribose; RNA's ribose carries one more oxygen, on its 2' carbon. */
const SugarSchema = Schema.Literals(["deoxyribose", "ribose"]);
type Sugar = typeof SugarSchema.Type;

/**
 * B-DNA, the form inside cells: 3.4 angstrom between base pairs and 10.5 base
 * pairs to a turn (Watson and Crick 1953; Arnott and Hukins 1972; Wang 1979).
 */
export const HELIX_RISE = 3.4;
export const HELIX_TURN = (Math.PI * 2) / 10.5;

/** One named atom of a residue: its name, its element and its x, y and z in the base pair's frame. */
export const NamedSchema = Schema.Tuple([
  Schema.String,
  ElementSchema,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Named = typeof NamedSchema.Type;

/** One bond of a residue between two named atoms, single or double. */
export const LinkSchema = Schema.Tuple([
  Schema.String,
  Schema.String,
  Schema.Literals([1, 2]),
]);
export type Link = typeof LinkSchema.Type;

/**
 * The sugar and phosphate of one nucleotide in the standard base pair frame
 * (Olson et al. 2001: x toward the major groove, y toward this strand, z up
 * the helix along the strand's 5' to 3' direction). The conformation is the
 * mean backbone of the B-DNA dodecamer 1BNA (Drew et al. 1981), refined so
 * that every bond length and angle takes its standard value (Gelbin et al.
 * 1996) and the 3' oxygen meets the next phosphorus exactly under the helix's
 * rise and turn.
 */
const BACKBONE: readonly Named[] = [
  ["P", "P", 0.115, 9.267, -1.123],
  ["OP1", "O", 0.418, 10.72, -1.092],
  ["OP2", "O", 0.843, 8.345, -0.214],
  ["O5'", "O", -1.448, 9.077, -0.868],
  ["C5'", "C", -2.256, 8.338, -1.806],
  ["C4'", "C", -3.117, 7.325, -1.09],
  ["O4'", "O", -2.561, 6.007, -1.254],
  ["C3'", "C", -3.293, 7.546, 0.4],
  ["O3'", "O", -4.667, 7.416, 0.768],
  ["C2'", "C", -2.453, 6.457, 1.045],
  ["C1'", "C", -2.479, 5.346, 0],
];

/** The oxygen ribose carries on its 2' carbon, on the same face as the 3' oxygen. */
const RIBOSE_OXYGEN: Named = ["O2'", "O", -3.029, 6.024, 2.261];

/** The third oxygen of a phosphate that no neighbour's sugar is bonded to: where the previous 3' oxygen would stand. */
const END_OXYGEN: Named = ["OP3", "O", 0.321, 8.756, -2.632];

const BACKBONE_LINKS: readonly Link[] = [
  ["P", "OP1", 2],
  ["P", "OP2", 1],
  ["P", "OP3", 1],
  ["P", "O5'", 1],
  ["O5'", "C5'", 1],
  ["C5'", "C4'", 1],
  ["C4'", "O4'", 1],
  ["C4'", "C3'", 1],
  ["C3'", "O3'", 1],
  ["C3'", "C2'", 1],
  ["C2'", "O2'", 1],
  ["C2'", "C1'", 1],
  ["C1'", "O4'", 1],
];

/** The backbone atoms a ribbon's tube stands for; the sugar ring stays drawn. */
const SPINE = ["P", "OP1", "OP2", "OP3", "O5'", "C5'", "O3'"];

/** The atoms of the phosphate group, for a nucleotide's parts. */
const PHOSPHATE = ["P", "OP1", "OP2", "OP3", "O5'"];

/**
 * Each base as its ring atoms in the standard reference frame of Olson et
 * al. (2001), flat in the plane of the base pair, with its Kekule bonds and
 * its bond to the sugar's 1' carbon.
 */
const PURINE_RING: readonly Link[] = [
  ["N9", "C8", 1],
  ["C8", "N7", 2],
  ["N7", "C5", 1],
  ["C5", "C6", 1],
  ["N1", "C2", 1],
  ["C2", "N3", 2],
  ["N3", "C4", 1],
  ["C4", "C5", 2],
  ["C4", "N9", 1],
  ["C1'", "N9", 1],
];
const PYRIMIDINE_RING: readonly Link[] = [
  ["N1", "C2", 1],
  ["C2", "O2", 2],
  ["C2", "N3", 1],
  ["C4", "C5", 1],
  ["C5", "C6", 2],
  ["C6", "N1", 1],
  ["C1'", "N1", 1],
];
const URACIL: readonly Named[] = [
  ["N1", "N", -1.284, 4.5, 0],
  ["C2", "C", -1.462, 3.135, 0],
  ["O2", "O", -2.562, 2.608, 0],
  ["N3", "N", -0.298, 2.407, 0],
  ["C4", "C", 0.994, 2.897, 0],
  ["O4", "O", 1.944, 2.119, 0],
  ["C5", "C", 1.106, 4.338, 0],
  ["C6", "C", -0.024, 5.057, 0],
];
const URACIL_LINKS: readonly Link[] = [
  ...PYRIMIDINE_RING,
  ["N3", "C4", 1],
  ["C4", "O4", 2],
];
/** One base: its ring atoms and the bonds between them. */
const RingSchema = Schema.Struct({
  atoms: Schema.Array(NamedSchema),
  links: Schema.Array(LinkSchema),
});
const BASES: Record<Base, typeof RingSchema.Type> = {
  A: {
    atoms: [
      ["N9", "N", -1.291, 4.498, 0],
      ["C8", "C", 0.024, 4.897, 0],
      ["N7", "N", 0.877, 3.902, 0],
      ["C5", "C", 0.071, 2.771, 0],
      ["C6", "C", 0.369, 1.398, 0],
      ["N6", "N", 1.611, 0.909, 0],
      ["N1", "N", -0.668, 0.532, 0],
      ["C2", "C", -1.912, 1.023, 0],
      ["N3", "N", -2.32, 2.29, 0],
      ["C4", "C", -1.267, 3.124, 0],
    ],
    links: [...PURINE_RING, ["C6", "N6", 1], ["C6", "N1", 2]],
  },
  C: {
    atoms: [
      ["N1", "N", -1.285, 4.542, 0],
      ["C2", "C", -1.472, 3.158, 0],
      ["O2", "O", -2.628, 2.709, 0],
      ["N3", "N", -0.391, 2.344, 0],
      ["C4", "C", 0.837, 2.868, 0],
      ["N4", "N", 1.875, 2.027, 0],
      ["C5", "C", 1.056, 4.275, 0],
      ["C6", "C", -0.023, 5.068, 0],
    ],
    links: [...PYRIMIDINE_RING, ["N3", "C4", 2], ["C4", "N4", 1]],
  },
  G: {
    atoms: [
      ["N9", "N", -1.289, 4.551, 0],
      ["C8", "C", 0.023, 4.962, 0],
      ["N7", "N", 0.87, 3.969, 0],
      ["C5", "C", 0.071, 2.833, 0],
      ["C6", "C", 0.424, 1.46, 0],
      ["O6", "O", 1.554, 0.955, 0],
      ["N1", "N", -0.7, 0.641, 0],
      ["C2", "C", -1.999, 1.087, 0],
      ["N2", "N", -2.949, 0.139, 0],
      ["N3", "N", -2.342, 2.364, 0],
      ["C4", "C", -1.265, 3.177, 0],
    ],
    links: [...PURINE_RING, ["C6", "O6", 2], ["C6", "N1", 1], ["C2", "N2", 1]],
  },
  T: {
    atoms: [...URACIL, ["C7", "C", 2.466, 4.961, 0]],
    links: [...URACIL_LINKS, ["C5", "C7", 1]],
  },
  U: { atoms: URACIL, links: URACIL_LINKS },
};

/**
 * The hydrogen bonds of a Watson and Crick pair, from an atom of the first
 * strand's base to an atom of its partner: two between A and T or U, three
 * between G and C.
 */
const PAIR_TIES: Record<Base, readonly (readonly [string, string])[]> = {
  A: [
    ["N6", "O4"],
    ["N1", "N3"],
  ],
  C: [
    ["N4", "O6"],
    ["N3", "N1"],
    ["O2", "N2"],
  ],
  G: [
    ["O6", "N4"],
    ["N1", "N3"],
    ["N2", "O2"],
  ],
  T: [
    ["O4", "N6"],
    ["N3", "N1"],
  ],
  U: [
    ["O4", "N6"],
    ["N3", "N1"],
  ],
};

/**
 * One base pair's place along a helix: the base on each strand, or none where
 * that strand is missing, the sugar they are built on, how far round the axis
 * the pair is turned, how far up the axis it stands and how far it is pushed
 * sideways, as where a replication fork pulls the strands apart.
 */
export const StepSchema = Schema.Struct({
  first: Schema.UndefinedOr(BaseSchema),
  rise: Schema.Finite,
  second: Schema.UndefinedOr(BaseSchema),
  shift: Schema.Finite,
  sugar: SugarSchema,
  turn: Schema.Finite,
});
export type Step = typeof StepSchema.Type;

/** One residue ready to join a molecule: its named atoms in place, its bonds by name, and the index its first atom takes. */
const ResidueSchema = Schema.Struct({
  atoms: Schema.Array(NamedSchema),
  base: BaseSchema,
  links: Schema.Array(LinkSchema),
  offset: Schema.Finite,
  step: Schema.Finite,
  strand: Schema.Literals([0, 1]),
});
type Residue = typeof ResidueSchema.Type;

/** The base that pairs with each base in DNA. */
const PARTNERS = { A: "T", C: "G", G: "C", T: "A", U: "A" } as const;

/** The atoms and bonds of one nucleotide in its strand's frame, with the 2' oxygen of ribose and, at a 5' end, the phosphate's third oxygen. */
export function residueOf(base: Base, sugar: Sugar, end: boolean) {
  return {
    atoms: [
      ...BACKBONE,
      ...(sugar === "ribose" ? [RIBOSE_OXYGEN] : []),
      ...(end ? [END_OXYGEN] : []),
      ...BASES[base].atoms,
    ],
    links: [...BACKBONE_LINKS, ...BASES[base].links],
  };
}

/** Where the atom called `name` is in a list of named atoms. */
function indexOf(atoms: readonly Named[], name: string) {
  return Arr.findFirstIndex(atoms, (atom) => atom[0] === name);
}

/** The bonds of a residue whose atoms start at `offset`; a bond to an atom the residue lacks is left out. */
export function bondsOf(
  atoms: readonly Named[],
  links: readonly Link[],
  offset: number
): readonly Bond[] {
  return Arr.flatMap(links, ([from, to, order]) =>
    Arr.map(
      Option.toArray(Option.all([indexOf(atoms, from), indexOf(atoms, to)])),
      ([start, end]) => ({ from: offset + start, order, to: offset + end })
    )
  );
}

/**
 * One free nucleotide, a deoxynucleoside 5'-monophosphate, with every atom:
 * the phosphate group is part 0, the deoxyribose part 1 and the base part 2,
 * and each hydrogen belongs to the part of the atom that carries it.
 */
export function nucleotideOf(base: Base): Molecule {
  const { atoms, links } = residueOf(base, "deoxyribose", true);
  return saturate({
    atoms: Arr.map(atoms, ([name, element, x, y, z]) => ({
      at: [x, y, z] as const,
      element,
      part: partOf(name),
      spine: false,
    })),
    bonds: bondsOf(atoms, links, 0),
    ties: [],
    traces: [],
  });
}

/** Which part of a nucleotide an atom belongs to: phosphate, sugar or base. */
export function partOf(name: string) {
  if (Arr.contains(PHOSPHATE, name)) {
    return 0;
  }
  return name.endsWith("'") ? 1 : 2;
}

/** Where an atom of the strand frame stands once its pair is placed along the helix. */
function placed(at: Point, step: Step, strand: 0 | 1): Point {
  const own: Point = strand === 0 ? at : [at[0], -at[1], -at[2]];
  return add(screw(own, step.turn, step.rise), [0, step.shift, 0]);
}

/** The residues of every step, each strand's atoms moved to their place and numbered after those before them. */
function residuesOf(steps: readonly Step[]): readonly Residue[] {
  const loose = Arr.flatMap(steps, (step, index) =>
    Arr.flatMap([0, 1] as const, (strand) => {
      const base = strand === 0 ? step.first : step.second;
      const before = steps[index + (strand === 0 ? -1 : 1)];
      if (base === undefined) {
        return [];
      }
      const end = (strand === 0 ? before?.first : before?.second) === undefined;
      const { atoms, links } = residueOf(base, step.sugar, end);
      return [
        {
          atoms: Arr.map(
            atoms,
            ([name, element, x, y, z]): Named => [
              name,
              element,
              ...placed([x, y, z], step, strand),
            ]
          ),
          base,
          links,
          step: index,
          strand,
        },
      ];
    })
  );
  return Arr.map(loose, (residue, index) => ({
    ...residue,
    offset: Arr.reduce(
      Arr.take(loose, index),
      0,
      (sum, other) => sum + other.atoms.length
    ),
  }));
}

/** Where the atom called `name` of a residue stands. */
function atomOf(residue: Residue, name: string) {
  return Option.map(
    Arr.findFirst(residue.atoms, (atom) => atom[0] === name),
    ([, , x, y, z]): Point => [x, y, z]
  );
}

/**
 * A stretch of double or single stranded nucleic acid as all of its heavy
 * atoms, as a crystal structure gives them. Each strand's nucleotides are
 * bonded 3' to 5' along it, the second strand running the other way; paired
 * bases are tied by their hydrogen bonds; and each unbroken run of a strand
 * leaves the trace its ribbon follows. The atoms of step `n` belong to part
 * `2n` on the first strand and `2n + 1` on the second.
 */
export function helixOf(steps: readonly Step[]): Molecule {
  const residues = residuesOf(steps);
  return {
    atoms: Arr.flatMap(residues, (residue) =>
      Arr.map(residue.atoms, ([name, element, x, y, z]) => ({
        at: [x, y, z] as const,
        element,
        part: residue.step * 2 + residue.strand,
        spine: Arr.contains(SPINE, name),
      }))
    ),
    bonds: Arr.flatMap(residues, (residue) => [
      ...bondsOf(residue.atoms, residue.links, residue.offset),
      ...Arr.flatMap(
        Arr.filter(
          residues,
          (other) =>
            other.strand === residue.strand &&
            other.step === residue.step + (residue.strand === 0 ? 1 : -1)
        ),
        (next: Residue) =>
          Arr.map(
            Option.toArray(
              Option.all([
                indexOf(residue.atoms, "O3'"),
                indexOf(next.atoms, "P"),
              ])
            ),
            ([from, to]) => ({
              from: residue.offset + from,
              order: 1 as const,
              to: next.offset + to,
            })
          )
      ),
    ]),
    ties: Arr.flatMap(
      Arr.filter(residues, (residue) => residue.strand === 0),
      (residue: Residue) =>
        Arr.flatMap(
          Arr.filter(
            residues,
            (other) =>
              other.strand === 1 &&
              other.step === residue.step &&
              (PARTNERS[residue.base] === other.base ||
                PARTNERS[other.base] === residue.base)
          ),
          (partner: Residue) =>
            Arr.flatMap(PAIR_TIES[residue.base], ([from, to]) =>
              Option.toArray(
                Option.all([atomOf(residue, from), atomOf(partner, to)])
              )
            )
        )
    ),
    traces: tracesOf(residues),
  };
}

/** The backbone trace of each unbroken run of each strand: its phosphorus and 4' carbon, residue after residue. */
function tracesOf(residues: readonly Residue[]): readonly (readonly Point[])[] {
  return Arr.flatMap([0, 1] as const, (strand) => {
    const own = Arr.filter(residues, (residue) => residue.strand === strand);
    const starts = Arr.filter(
      own,
      (residue) => !Arr.some(own, (other) => other.step === residue.step - 1)
    );
    return Arr.map(starts, (start) =>
      Arr.flatMap(
        Arr.takeWhile(
          Arr.filter(own, (residue) => residue.step >= start.step),
          (residue, index) => residue.step === start.step + index
        ),
        (residue: Residue) =>
          Arr.flatMap(strand === 0 ? ["P", "C4'"] : ["C4'", "P"], (name) =>
            Option.toArray(atomOf(residue, name))
          )
      )
    );
  });
}

/** The steps of a straight B-form double helix with `bases` on its first strand and their partners on the second. */
export function duplexOf(bases: readonly Base[]): readonly Step[] {
  return Arr.map(bases, (base, index) => ({
    first: base,
    rise: index * HELIX_RISE,
    second: PARTNERS[base],
    shift: 0,
    sugar: "deoxyribose" as const,
    turn: index * HELIX_TURN,
  }));
}
