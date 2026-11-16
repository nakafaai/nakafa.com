import {
  ELEMENTS,
  type ElementSymbol,
  ElementSymbolSchema,
} from "@repo/design-system/components/contents/chemistry/molecule/elements";
import {
  buildMolecule,
  type Placement,
  PlacementSchema,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Array as Arr, Result, Schema } from "effect";

/** Every molecule the molecule and reaction labs can draw. */
export const MoleculeIdSchema = Schema.Literals([
  "hydrogen",
  "oxygen",
  "nitrogen",
  "chlorine",
  "hydrogen-chloride",
  "carbon-monoxide",
  "nitrogen-monoxide",
  "water",
  "hydrogen-peroxide",
  "carbon-dioxide",
  "sulfur-dioxide",
  "nitrogen-dioxide",
  "dinitrogen-monoxide",
  "ozone",
  "sulfur-trioxide",
  "ammonia",
  "methane",
  "ethene",
  "ethane",
  "ethyne",
  "propane",
  "ethanol",
  "methanol",
]);
export type MoleculeId = typeof MoleculeIdSchema.Type;

/** Where a molecule's teaching angle sits: the atom at its vertex and its two arms. */
export const AngleSchema = Schema.Struct({
  arms: Schema.Tuple([Schema.Int, Schema.Int]),
  vertex: Schema.Int,
});

/** One catalog molecule: its teaching angle, formula and Z-matrix. */
const MoleculeSourceSchema = Schema.Struct({
  angle: Schema.optional(AngleSchema),
  formula: Schema.String,
  placements: Schema.Array(PlacementSchema),
});

/**
 * The dihedral that gives three equal bonds about one axis atom the same angle
 * `degrees` with each other, as in ammonia (106.7) or methane (109.47): from
 * the spherical law of cosines, cos(phi) = cos(theta) / (1 + cos(theta)).
 */
export function pyramidDihedral(degrees: number) {
  const cosine = Math.cos((degrees * Math.PI) / 180);
  return (Math.acos(cosine / (1 + cosine)) * 180) / Math.PI;
}

/** The angle between any two bonds of a regular tetrahedron, about 109.47 degrees. */
export const TETRAHEDRAL_ANGLE = (Math.acos(-1 / 3) * 180) / Math.PI;

/** A diatomic molecule from its bond length in picometres and its bond order. */
function diatomic(
  first: ElementSymbol,
  second: ElementSymbol,
  bond: number,
  order: 1 | 2 | 3
): readonly Placement[] {
  return [
    { element: first },
    { bond: { length: bond, order, to: 0 }, element: second },
  ];
}

/**
 * A three-atom molecule bent at its central atom: two bonds of the given
 * lengths and orders that meet at `angle` degrees, or 180 for a straight one.
 */
function triatomic(
  center: ElementSymbol,
  ends: readonly [ElementSymbol, ElementSymbol],
  bonds: readonly [number, number],
  orders: readonly [1 | 2 | 3, 1 | 2 | 3],
  angle: number
): readonly Placement[] {
  return [
    { element: center },
    { bond: { length: bonds[0], order: orders[0], to: 0 }, element: ends[0] },
    {
      angle: { degrees: angle, to: 1 },
      bond: { length: bonds[1], order: orders[1], to: 0 },
      element: ends[1],
    },
  ];
}

/**
 * A central atom with three or four equal bonds of `bond` picometres that meet
 * at `angle` degrees: a trigonal pyramid (ammonia) or a tetrahedron (methane).
 */
function pyramid(
  center: ElementSymbol,
  arm: ElementSymbol,
  bond: number,
  angle: number,
  arms: 3 | 4
): readonly Placement[] {
  const twist = pyramidDihedral(angle);
  const base: readonly Placement[] = [
    { element: center },
    { bond: { length: bond, to: 0 }, element: arm },
    {
      angle: { degrees: angle, to: 1 },
      bond: { length: bond, to: 0 },
      element: arm,
    },
    {
      angle: { degrees: angle, to: 1 },
      bond: { length: bond, to: 0 },
      dihedral: { degrees: twist, to: 2 },
      element: arm,
    },
  ];
  return arms === 3
    ? base
    : Arr.append(base, {
        angle: { degrees: angle, to: 1 },
        bond: { length: bond, to: 0 },
        dihedral: { degrees: -twist, to: 2 },
        element: arm,
      });
}

/**
 * Three hydrogens on the carbon `carbon`, each at `angle` degrees from the bond
 * to `neighbor`, staggered against the chain atom `away` seen along that bond,
 * as a methyl group sits.
 */
function methyl(
  carbon: number,
  neighbor: number,
  away: number,
  start: number,
  angle: number
): readonly Placement[] {
  return Arr.map([start, start + 120, start - 120], (degrees) => ({
    angle: { degrees: angle, to: neighbor },
    bond: { length: 109.4, to: carbon },
    dihedral: { degrees, to: away },
    element: "H" as const,
  }));
}

/**
 * Every molecule as a Z-matrix of measured gas-phase bond lengths (pm) and
 * angles (degrees), from the NIST Computational Chemistry Comparison and
 * Benchmark Database (CCCBDB, experimental geometries). Each places its first
 * three atoms in the xy plane, which faces the lab's camera.
 */
const SOURCES = {
  "carbon-dioxide": {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{CO_2}",
    placements: triatomic("C", ["O", "O"], [116, 116], [2, 2], 180),
  },
  "carbon-monoxide": {
    formula: "\\mathrm{CO}",
    placements: diatomic("C", "O", 112.8, 3),
  },
  chlorine: {
    formula: "\\mathrm{Cl_2}",
    placements: diatomic("Cl", "Cl", 198.8, 1),
  },
  "dinitrogen-monoxide": {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{N_2O}",
    placements: triatomic("N", ["N", "O"], [112.8, 118.4], [2, 2], 180),
  },
  ammonia: {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{NH_3}",
    placements: pyramid("N", "H", 101.2, 106.7, 3),
  },
  ethane: {
    angle: { arms: [2, 1], vertex: 0 },
    formula: "\\mathrm{C_2H_6}",
    placements: [
      { element: "C" },
      { bond: { length: 153.5, to: 0 }, element: "C" },
      {
        angle: { degrees: 111.2, to: 1 },
        bond: { length: 109.4, to: 0 },
        element: "H",
      },
      ...Arr.take(methyl(0, 1, 2, 120, 111.2), 2),
      ...methyl(1, 0, 2, 180, 111.2),
    ],
  },
  ethanol: {
    angle: { arms: [1, 3], vertex: 2 },
    formula: "\\mathrm{C_2H_5OH}",
    placements: [
      { element: "C" },
      { bond: { length: 151.2, to: 0 }, element: "C" },
      {
        angle: { degrees: 107.8, to: 0 },
        bond: { length: 143.1, to: 1 },
        element: "O",
      },
      {
        angle: { degrees: 105.4, to: 1 },
        bond: { length: 97.1, to: 2 },
        dihedral: { degrees: 180, to: 0 },
        element: "H",
      },
      ...methyl(0, 1, 2, 180, 110.7),
      {
        angle: { degrees: 110.1, to: 0 },
        bond: { length: 109.5, to: 1 },
        dihedral: { degrees: 121.6, to: 2 },
        element: "H",
      },
      {
        angle: { degrees: 110.1, to: 0 },
        bond: { length: 109.5, to: 1 },
        dihedral: { degrees: -121.6, to: 2 },
        element: "H",
      },
    ],
  },
  ethene: {
    angle: { arms: [2, 3], vertex: 0 },
    formula: "\\mathrm{C_2H_4}",
    placements: [
      { element: "C" },
      { bond: { length: 133.9, order: 2, to: 0 }, element: "C" },
      {
        angle: { degrees: 121.3, to: 1 },
        bond: { length: 108.7, to: 0 },
        element: "H",
      },
      {
        angle: { degrees: 121.3, to: 1 },
        bond: { length: 108.7, to: 0 },
        dihedral: { degrees: 180, to: 2 },
        element: "H",
      },
      {
        angle: { degrees: 121.3, to: 0 },
        bond: { length: 108.7, to: 1 },
        dihedral: { degrees: 0, to: 2 },
        element: "H",
      },
      {
        angle: { degrees: 121.3, to: 0 },
        bond: { length: 108.7, to: 1 },
        dihedral: { degrees: 180, to: 2 },
        element: "H",
      },
    ],
  },
  ethyne: {
    angle: { arms: [2, 1], vertex: 0 },
    formula: "\\mathrm{C_2H_2}",
    placements: [
      { element: "C" },
      { bond: { length: 120.3, order: 3, to: 0 }, element: "C" },
      {
        angle: { degrees: 180, to: 1 },
        bond: { length: 106.3, to: 0 },
        element: "H",
      },
      {
        angle: { degrees: 180, to: 0 },
        bond: { length: 106.3, to: 1 },
        element: "H",
      },
    ],
  },
  hydrogen: {
    formula: "\\mathrm{H_2}",
    placements: diatomic("H", "H", 74.1, 1),
  },
  "hydrogen-chloride": {
    formula: "\\mathrm{HCl}",
    placements: diatomic("H", "Cl", 127.5, 1),
  },
  "hydrogen-peroxide": {
    angle: { arms: [2, 1], vertex: 0 },
    formula: "\\mathrm{H_2O_2}",
    placements: [
      { element: "O" },
      { bond: { length: 147.5, to: 0 }, element: "O" },
      {
        angle: { degrees: 94.8, to: 1 },
        bond: { length: 95, to: 0 },
        element: "H",
      },
      {
        angle: { degrees: 94.8, to: 0 },
        bond: { length: 95, to: 1 },
        dihedral: { degrees: 111.5, to: 2 },
        element: "H",
      },
    ],
  },
  methanol: {
    angle: { arms: [0, 2], vertex: 1 },
    formula: "\\mathrm{CH_3OH}",
    placements: [
      { element: "C" },
      { bond: { length: 142.7, to: 0 }, element: "O" },
      {
        angle: { degrees: 108.5, to: 0 },
        bond: { length: 95.6, to: 1 },
        element: "H",
      },
      ...methyl(0, 1, 2, 180, 109.5),
    ],
  },
  methane: {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{CH_4}",
    placements: pyramid("C", "H", 108.7, TETRAHEDRAL_ANGLE, 4),
  },
  nitrogen: {
    formula: "\\mathrm{N_2}",
    placements: diatomic("N", "N", 109.8, 3),
  },
  "nitrogen-dioxide": {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{NO_2}",
    placements: triatomic("N", ["O", "O"], [119.7, 119.7], [2, 1], 134.3),
  },
  "nitrogen-monoxide": {
    formula: "\\mathrm{NO}",
    placements: diatomic("N", "O", 115.1, 2),
  },
  oxygen: {
    formula: "\\mathrm{O_2}",
    placements: diatomic("O", "O", 120.7, 2),
  },
  ozone: {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{O_3}",
    placements: triatomic("O", ["O", "O"], [127.8, 127.8], [2, 1], 116.8),
  },
  propane: {
    angle: { arms: [0, 2], vertex: 1 },
    formula: "\\mathrm{C_3H_8}",
    placements: [
      { element: "C" },
      { bond: { length: 152.6, to: 0 }, element: "C" },
      {
        angle: { degrees: 112.4, to: 0 },
        bond: { length: 152.6, to: 1 },
        element: "C",
      },
      ...methyl(0, 1, 2, 180, 110.7),
      ...methyl(2, 1, 0, 180, 110.7),
      {
        angle: { degrees: 109.5, to: 0 },
        bond: { length: 109.6, to: 1 },
        dihedral: { degrees: 121.9, to: 2 },
        element: "H",
      },
      {
        angle: { degrees: 109.5, to: 0 },
        bond: { length: 109.6, to: 1 },
        dihedral: { degrees: -121.9, to: 2 },
        element: "H",
      },
    ],
  },
  "sulfur-dioxide": {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{SO_2}",
    placements: triatomic("S", ["O", "O"], [143.1, 143.1], [2, 2], 119.5),
  },
  "sulfur-trioxide": {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{SO_3}",
    placements: [
      ...triatomic("S", ["O", "O"], [141.8, 141.8], [2, 2], 120),
      {
        angle: { degrees: 120, to: 1 },
        bond: { length: 141.8, order: 2, to: 0 },
        dihedral: { degrees: 180, to: 2 },
        element: "O",
      },
    ],
  },
  water: {
    angle: { arms: [1, 2], vertex: 0 },
    formula: "\\mathrm{H_2O}",
    placements: triatomic("O", ["H", "H"], [95.8, 95.8], [1, 1], 104.5),
  },
} satisfies Record<MoleculeId, typeof MoleculeSourceSchema.Type>;

/** The molecular formula of one molecule in TeX, such as "\\mathrm{H_2O}". */
export function moleculeFormula(id: MoleculeId) {
  return SOURCES[id].formula;
}

/** The atoms, bonds, and teaching angle of one molecule, ready to draw. */
export function getMolecule(id: MoleculeId) {
  const source: (typeof SOURCES)[MoleculeId] = SOURCES[id];
  const built = buildMolecule(source.placements);
  return Result.map(built, ({ bonds, positions }) => ({
    angle: "angle" in source ? source.angle : undefined,
    atoms: Arr.map(
      Arr.zip(source.placements, positions),
      ([placement, position]) => ({ element: placement.element, position })
    ),
    bonds,
    formula: source.formula,
    id,
  }));
}

/**
 * How many atoms of each element one molecule holds, in periodic-table order,
 * the order the element symbols are listed in.
 */
export function countAtoms(id: MoleculeId) {
  const { placements } = SOURCES[id];
  return Arr.flatMap(ElementSymbolSchema.literals, (element) => {
    const count = Arr.filter(
      placements,
      (placement) => placement.element === element
    ).length;
    return count === 0 ? [] : [[element, count] as const];
  });
}

/** The relative molecular mass, the sum of the school relative atomic masses. */
export function relativeMass(id: MoleculeId) {
  return Arr.reduce(
    countAtoms(id),
    0,
    (total, [element, count]) => total + count * ELEMENTS[element].mass
  );
}
