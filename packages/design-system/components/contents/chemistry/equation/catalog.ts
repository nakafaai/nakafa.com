import {
  countAtoms,
  MoleculeIdSchema,
  moleculeFormula,
  relativeMass,
} from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import {
  type ElementSymbol,
  ElementSymbolSchema,
} from "@repo/design-system/components/contents/chemistry/molecule/elements";
import type { MathNumber } from "@repo/design-system/components/contents/chemistry/molecule/facts";
import { Array as Arr, Option, Schema } from "effect";
import { constant } from "effect/Function";

/** Every balanced reaction the reaction lab can run. */
export const ReactionIdSchema = Schema.Literals([
  "water-synthesis",
  "hydrogen-chloride-synthesis",
  "ammonia-synthesis",
  "methane-combustion",
  "propane-combustion",
  "ethanol-combustion",
  "peroxide-decomposition",
  "water-electrolysis",
  "carbon-monoxide-oxidation",
  "nitrogen-monoxide-oxidation",
  "nitrogen-fixation",
  "sulfur-dioxide-oxidation",
  "ethene-hydrogenation",
  "ethene-hydration",
  "ethanol-dehydration",
  "ozone-formation",
]);
export type ReactionId = typeof ReactionIdSchema.Type;

/** One substance of a reaction and its coefficient in the balanced equation. */
const TermSchema = Schema.Tuple([MoleculeIdSchema, Schema.Int]);
type Term = typeof TermSchema.Type;

/** The reactants and products of one reaction, the wanted product first. */
const ReactionSchema = Schema.Struct({
  products: Schema.Array(TermSchema),
  reactants: Schema.Array(TermSchema),
});

/**
 * Every reaction, balanced, with the product the lesson wants first, which the
 * atom economy reads.
 */
const REACTIONS = {
  "ammonia-synthesis": {
    products: [["ammonia", 2]],
    reactants: [
      ["nitrogen", 1],
      ["hydrogen", 3],
    ],
  },
  "carbon-monoxide-oxidation": {
    products: [["carbon-dioxide", 2]],
    reactants: [
      ["carbon-monoxide", 2],
      ["oxygen", 1],
    ],
  },
  "ethanol-combustion": {
    products: [
      ["carbon-dioxide", 2],
      ["water", 3],
    ],
    reactants: [
      ["ethanol", 1],
      ["oxygen", 3],
    ],
  },
  "ethanol-dehydration": {
    products: [
      ["ethene", 1],
      ["water", 1],
    ],
    reactants: [["ethanol", 1]],
  },
  "ethene-hydration": {
    products: [["ethanol", 1]],
    reactants: [
      ["ethene", 1],
      ["water", 1],
    ],
  },
  "ethene-hydrogenation": {
    products: [["ethane", 1]],
    reactants: [
      ["ethene", 1],
      ["hydrogen", 1],
    ],
  },
  "hydrogen-chloride-synthesis": {
    products: [["hydrogen-chloride", 2]],
    reactants: [
      ["hydrogen", 1],
      ["chlorine", 1],
    ],
  },
  "methane-combustion": {
    products: [
      ["carbon-dioxide", 1],
      ["water", 2],
    ],
    reactants: [
      ["methane", 1],
      ["oxygen", 2],
    ],
  },
  "nitrogen-fixation": {
    products: [["nitrogen-monoxide", 2]],
    reactants: [
      ["nitrogen", 1],
      ["oxygen", 1],
    ],
  },
  "nitrogen-monoxide-oxidation": {
    products: [["nitrogen-dioxide", 2]],
    reactants: [
      ["nitrogen-monoxide", 2],
      ["oxygen", 1],
    ],
  },
  "ozone-formation": {
    products: [["ozone", 2]],
    reactants: [["oxygen", 3]],
  },
  "peroxide-decomposition": {
    products: [
      ["water", 2],
      ["oxygen", 1],
    ],
    reactants: [["hydrogen-peroxide", 2]],
  },
  "propane-combustion": {
    products: [
      ["carbon-dioxide", 3],
      ["water", 4],
    ],
    reactants: [
      ["propane", 1],
      ["oxygen", 5],
    ],
  },
  "sulfur-dioxide-oxidation": {
    products: [["sulfur-trioxide", 2]],
    reactants: [
      ["sulfur-dioxide", 2],
      ["oxygen", 1],
    ],
  },
  "water-electrolysis": {
    products: [
      ["hydrogen", 2],
      ["oxygen", 1],
    ],
    reactants: [["water", 2]],
  },
  "water-synthesis": {
    products: [["water", 2]],
    reactants: [
      ["hydrogen", 2],
      ["oxygen", 1],
    ],
  },
} as const satisfies Record<ReactionId, typeof ReactionSchema.Type>;

/** The reactants and products of one reaction with their coefficients. */
export function getReaction(id: ReactionId): typeof ReactionSchema.Type {
  return REACTIONS[id];
}

/** One side of an equation in TeX: "2\,\mathrm{H_2} + \mathrm{O_2}". */
function sideTex(terms: readonly Term[]) {
  return Arr.join(
    Arr.map(terms, ([molecule, coefficient]) =>
      coefficient === 1
        ? moleculeFormula(molecule)
        : `${coefficient}\\,${moleculeFormula(molecule)}`
    ),
    " + "
  );
}

/** The balanced equation in TeX, with the arrow the corpus writes. */
export function equationTex(id: ReactionId) {
  const { products, reactants } = getReaction(id);
  return `${sideTex(reactants)} \\rightarrow ${sideTex(products)}`;
}

/** How many atoms of each element one side holds, in periodic-table order. */
export function sideAtoms(terms: readonly Term[]) {
  return Arr.flatMap(ElementSymbolSchema.literals, (element) => {
    const count = Arr.reduce(terms, 0, (total, [molecule, coefficient]) =>
      Option.match(
        Arr.findFirst(countAtoms(molecule), ([each]) => each === element),
        {
          onNone: constant(total),
          onSome: ([, atoms]) => total + atoms * coefficient,
        }
      )
    );
    return count === 0 ? [] : [[element, count] as const];
  });
}

/** How many atoms of `element` a side holds, none when it holds none. */
function countOf(atoms: ReturnType<typeof sideAtoms>, element: ElementSymbol) {
  return Option.getOrElse(
    Option.map(
      Arr.findFirst(atoms, ([each]) => each === element),
      ([, count]) => count
    ),
    constant(0)
  );
}

/**
 * The atoms of each element on both sides as math, which a balanced equation
 * keeps equal: "\\mathrm{H}: 4 = 4,\\ \\mathrm{O}: 2 = 2".
 */
export function balanceTex(id: ReactionId) {
  const { products, reactants } = getReaction(id);
  const before = sideAtoms(reactants);
  const after = sideAtoms(products);
  return Arr.join(
    Arr.map(
      before,
      ([element, count]) =>
        `\\mathrm{${element}}: ${count} = ${countOf(after, element)}`
    ),
    ",\\ "
  );
}

/** The total relative mass of one side. */
function sideMass(terms: readonly Term[]) {
  return Arr.reduce(
    terms,
    0,
    (total, [molecule, coefficient]) =>
      total + coefficient * relativeMass(molecule)
  );
}

/** The masses of both sides as math, equal by conservation: "36 = 36". */
export function massBalanceTex(id: ReactionId, format: MathNumber) {
  const { products, reactants } = getReaction(id);
  return `${format(sideMass(reactants))} = ${format(sideMass(products))}`;
}

/** How many molecules each side holds: "3 \rightarrow 2". */
export function moleculeCountTex(id: ReactionId) {
  const { products, reactants } = getReaction(id);
  const count = (terms: readonly Term[]) =>
    Arr.reduce(terms, 0, (total, [, coefficient]) => total + coefficient);
  return `${count(reactants)} \\rightarrow ${count(products)}`;
}

/**
 * The atom economy of the reaction's first product: the mass that ends in it,
 * out of the mass of every reactant, as a percentage.
 */
export function atomEconomy(id: ReactionId) {
  const { products, reactants } = getReaction(id);
  return Option.map(
    Arr.head(products),
    ([molecule, coefficient]) =>
      (100 * coefficient * relativeMass(molecule)) / sideMass(reactants)
  );
}

/** The atom economy worked out in math: "\dfrac{2(18)}{36} \times 100\% = 100\%". */
export function economyTex(id: ReactionId, format: MathNumber) {
  const { products, reactants } = getReaction(id);
  return Option.map(
    Option.all([Arr.head(products), atomEconomy(id)]),
    ([[molecule, coefficient], economy]) => {
      const product = format(relativeMass(molecule));
      const top = coefficient === 1 ? product : `${coefficient}(${product})`;
      return `\\dfrac{${top}}{${format(sideMass(reactants))}} \\times 100\\% = ${format(economy)}\\%`;
    }
  );
}
