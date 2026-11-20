import type { Placement } from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { PlacementSchema } from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Array as Arr, HashMap, Option, Record, Schema } from "effect";

/** The organic molecules of the SPM carbon compounds and polymers chapters. */
export const ORGANIC_IDS = [
  "hexane",
  "methylpentane-2",
  "methylpentane-3",
  "dimethylbutane-22",
  "dimethylbutane-23",
  "hexene",
  "dibromohexane",
  "propene",
  "propanol",
  "chloroethene",
] as const;

/**
 * One heavy atom of a skeleton: its element, the earlier carbon it bonds to,
 * and the bond's order. Every heavy atom but the first bonds to a carbon.
 */
const HeavySchema = Schema.Struct({
  element: Schema.Literals(["C", "O", "Cl", "Br"]),
  order: Schema.Literals([1, 2]),
  parent: Schema.Int,
});
type Heavy = typeof HeavySchema.Type;

/** One atom to place: a heavy atom, or a hydrogen on the heavy atom `parent`. */
const AtomSchema = Schema.Struct({
  element: Schema.Literals(["C", "O", "Cl", "Br", "H"]),
  onOxygen: Schema.Boolean,
  order: Schema.Literals([1, 2]),
  parent: Schema.Int,
});
type Atom = typeof AtomSchema.Type;

/** The reference every substituent of one atom is placed against, and how many it has placed. */
const FrameSchema = Schema.Struct({
  angleTo: Schema.Int,
  dihedralTo: Schema.optional(Schema.Int),
  proper: Schema.Boolean,
  used: Schema.Int,
});
type Frame = typeof FrameSchema.Type;

/** What a skeleton has placed so far: each atom's neighbours, each atom's frame, and the placements. */
const StateSchema = Schema.Struct({
  frames: Schema.HashMap(Schema.Int, FrameSchema),
  neighbours: Schema.HashMap(Schema.Int, Schema.Array(Schema.Int)),
  placements: Schema.Array(PlacementSchema),
});
type State = typeof StateSchema.Type;

/** How many bonds each element of a skeleton makes. */
const VALENCE = { Br: 1, C: 4, Cl: 1, O: 2 } as const;

/**
 * Bond lengths in picometres from typical measured values (CRC Handbook of
 * Chemistry and Physics, bond lengths in organic compounds): C–C 154,
 * C=C 134, C–O 143, C–Cl 173, C–Br 194, C–H 109 and O–H 96.
 */
const FROM_CARBON = { Br: 194, C: 154, Cl: 173, O: 143 } as const;

/** The length of the bond an atom makes to its parent. */
function bondLength(atom: Atom) {
  if (atom.element === "H") {
    return atom.onOxygen ? 96 : 109;
  }
  if (atom.element === "C" && atom.order === 2) {
    return 134;
  }
  return FROM_CARBON[atom.element];
}

/** The hydrogens a skeleton's heavy atom carries, up to its valence. */
function hydrogensOf(heavy: readonly Heavy[], atom: Heavy, index: number) {
  const own = index === 0 ? 0 : atom.order;
  const bonds = Arr.reduce(heavy, own, (sum, other, otherIndex) =>
    otherIndex > 0 && other.parent === index ? sum + other.order : sum
  );
  const free = VALENCE[atom.element] - bonds;
  if (free <= 0) {
    return [];
  }
  // Array.makeBy always makes at least one element, so a full atom returns above.
  return Arr.makeBy(
    free,
    (): Atom => ({
      element: "H",
      onOxygen: atom.element === "O",
      order: 1,
      parent: index,
    })
  );
}

/**
 * The Z-matrix of a molecule from its heavy-atom skeleton. Each heavy atom
 * bonds to an earlier one, and every atom then takes hydrogens up to its
 * valence. A substituent of a saturated atom sits at the tetrahedral angle
 * and one beside a double bond at 120°, and around each bond the
 * substituents are staggered: anti to the chain behind them, then at ±60°,
 * or at ±120° from a neighbour when the chain behind has no atom to face.
 */
function skeletonPlacements(heavy: readonly Heavy[]) {
  const atoms: readonly Atom[] = [
    ...Arr.map(heavy, (atom): Atom => ({ ...atom, onOxygen: false })),
    ...Arr.flatMap(heavy, (atom, index) => hydrogensOf(heavy, atom, index)),
  ];
  const start: State = {
    frames: HashMap.empty(),
    neighbours: HashMap.empty(),
    placements: [],
  };
  return Arr.reduce(atoms, start, (state, atom, index) =>
    place(state, atoms, atom, index)
  ).placements;
}

/** Places one atom against its parent's frame and records its bond. */
function place(
  state: State,
  atoms: readonly Atom[],
  atom: Atom,
  index: number
): State {
  if (index === 0) {
    return { ...state, placements: [{ element: atom.element }] };
  }
  const bond = {
    length: bondLength(atom),
    ...(atom.order === 2 ? { order: 2 as const } : {}),
    to: atom.parent,
  };
  const placed = neighboursOf(state, atom.parent);
  const linked = HashMap.set(
    HashMap.set(state.neighbours, atom.parent, [...placed, index]),
    index,
    [...neighboursOf(state, index), atom.parent]
  );
  return Arr.match(placed, {
    onEmpty: () => ({
      ...state,
      neighbours: linked,
      placements: [...state.placements, { bond, element: atom.element }],
    }),
    onNonEmpty: (around) => {
      const frame = HashMap.get(state.frames, atom.parent).pipe(
        Option.getOrElse(() => frameFor(state, atom.parent, around))
      );
      const flat = unsaturated(atoms, atom.parent);
      const placement: Placement =
        frame.dihedralTo === undefined
          ? {
              angle: {
                degrees: angleAt(atoms, atom.parent),
                to: frame.angleTo,
              },
              bond,
              element: atom.element,
            }
          : {
              angle: {
                degrees: angleAt(atoms, atom.parent),
                to: frame.angleTo,
              },
              bond,
              dihedral: {
                degrees: dihedralFor(frame, flat),
                to: frame.dihedralTo,
              },
              element: atom.element,
            };
      const next: Frame =
        frame.dihedralTo === undefined
          ? { ...frame, dihedralTo: index, proper: false }
          : { ...frame, used: frame.used + 1 };
      return {
        frames: HashMap.set(state.frames, atom.parent, next),
        neighbours: linked,
        placements: [...state.placements, placement],
      };
    },
  });
}

/** The atoms already bonded to one atom. */
function neighboursOf(state: State, atom: number) {
  return HashMap.get(state.neighbours, atom).pipe(Option.getOrElse(() => []));
}

/**
 * The frame an atom's first new substituent sets: its first neighbour for
 * the angle, and for the dihedral that neighbour's own neighbour when it has
 * one, or else the atom's second neighbour.
 */
function frameFor(
  state: State,
  atom: number,
  around: Arr.NonEmptyReadonlyArray<number>
): Frame {
  const angleTo = Arr.headNonEmpty(around);
  return Arr.findFirst(
    neighboursOf(state, angleTo),
    (other) => other !== atom
  ).pipe(
    Option.match({
      onNone: () => ({
        angleTo,
        dihedralTo: Option.getOrUndefined(Arr.get(around, 1)),
        proper: false,
        used: 0,
      }),
      onSome: (beyond) => ({
        angleTo,
        dihedralTo: beyond,
        proper: true,
        used: 0,
      }),
    })
  );
}

/** Whether an atom carries a double bond, so its substituents lie at 120°. */
function unsaturated(atoms: readonly Atom[], atom: number) {
  return Arr.some(
    atoms,
    (other, index) =>
      other.order === 2 &&
      (index === atom || (other.parent === atom && index > 0))
  );
}

/** The bond angle at an atom: 120° beside a double bond, 108.5° at an alcohol's oxygen, and the tetrahedral angle otherwise. */
function angleAt(atoms: readonly Atom[], atom: number) {
  if (unsaturated(atoms, atom)) {
    return 120;
  }
  const isOxygen = Arr.some(
    atoms,
    (other) => other.parent === atom && other.onOxygen
  );
  return isOxygen ? 108.5 : (Math.acos(-1 / 3) * 180) / Math.PI;
}

/** The dihedral of the next substituent in a frame, staggered about the bond. */
function dihedralFor(frame: Frame, flat: boolean) {
  if (flat) {
    return frame.proper && frame.used % 2 === 1 ? 0 : 180;
  }
  if (!frame.proper) {
    return frame.used % 2 === 0 ? 120 : -120;
  }
  if (frame.used === 0) {
    return 180;
  }
  return frame.used === 1 ? 60 : -60;
}

/** A straight chain of `length` carbons, the bond to carbon `doubleAt` a double one. */
function chain(length: number, doubleAt?: number): Heavy[] {
  return Arr.makeBy(length, (index) => ({
    element: "C" as const,
    order: index === doubleAt ? (2 as const) : (1 as const),
    parent: Math.max(0, index - 1),
  }));
}

/** A carbon branch on an atom of a skeleton. */
function methyl(parent: number): Heavy {
  return { element: "C", order: 1, parent };
}

/** A halogen or an oxygen on a carbon of a skeleton. */
function on(element: "O" | "Cl" | "Br", parent: number): Heavy {
  return { element, order: 1, parent };
}

/** One organic molecule: its formula and its heavy-atom skeleton. */
const SkeletonSchema = Schema.Struct({
  formula: Schema.String,
  heavy: Schema.Array(HeavySchema),
});

/** The skeletons and formulas of the organic molecules. */
const SKELETONS = {
  chloroethene: {
    formula: "\\mathrm{CH_2{=}CHCl}",
    heavy: [...chain(2, 1), on("Cl", 1)],
  },
  dibromohexane: {
    formula: "\\mathrm{C_6H_{12}Br_2}",
    heavy: [...chain(6), on("Br", 0), on("Br", 1)],
  },
  "dimethylbutane-22": {
    formula: "\\mathrm{C_6H_{14}}",
    heavy: [...chain(4), methyl(1), methyl(1)],
  },
  "dimethylbutane-23": {
    formula: "\\mathrm{C_6H_{14}}",
    heavy: [...chain(4), methyl(1), methyl(2)],
  },
  hexane: { formula: "\\mathrm{C_6H_{14}}", heavy: chain(6) },
  hexene: { formula: "\\mathrm{C_6H_{12}}", heavy: chain(6, 1) },
  "methylpentane-2": {
    formula: "\\mathrm{C_6H_{14}}",
    heavy: [...chain(5), methyl(1)],
  },
  "methylpentane-3": {
    formula: "\\mathrm{C_6H_{14}}",
    heavy: [...chain(5), methyl(2)],
  },
  propanol: {
    formula: "\\mathrm{C_3H_7OH}",
    heavy: [...chain(3), on("O", 2)],
  },
  propene: { formula: "\\mathrm{C_3H_6}", heavy: chain(3, 1) },
} satisfies Record<(typeof ORGANIC_IDS)[number], typeof SkeletonSchema.Type>;

/**
 * The organic molecules in the shape the molecule catalog keeps: a teaching
 * angle at the second carbon, a formula, and placements.
 */
export const ORGANIC_SOURCES = Record.map(SKELETONS, (skeleton) => ({
  angle: { arms: [0, 2] as const, vertex: 1 },
  formula: skeleton.formula,
  placements: skeletonPlacements(skeleton.heavy),
}));
