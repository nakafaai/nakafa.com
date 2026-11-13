import type { getReaction } from "@repo/design-system/components/contents/chemistry/equation/catalog";
import {
  getMolecule,
  type MoleculeId,
} from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import { ElementSymbolSchema } from "@repo/design-system/components/contents/chemistry/molecule/elements";
import {
  AtomSchema,
  type Bond,
  BondSchema,
  length,
  type Point,
  PointSchema,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Array as Arr, Data, Option, Order, Result, Schema } from "effect";

/** The room between two molecules of one side, in scene units. */
const MOLECULE_GAP = 0.7;

/** The room either side of the arrow between the two sides, in scene units. */
const ARROW_ROOM = 1.3;

/** One molecule placed on a side: its atoms where they stand, and its bonds. */
const PlacedSchema = Schema.Struct({
  atoms: Schema.Array(AtomSchema),
  bonds: Schema.Array(BondSchema),
});
type Placed = typeof PlacedSchema.Type;

/** One atom's path through the reaction, from its reactant to its product. */
const ParticleSchema = Schema.Struct({
  element: ElementSymbolSchema,
  end: PointSchema,
  product: Schema.Int,
  reactant: Schema.Int,
  start: PointSchema,
});
export type Particle = typeof ParticleSchema.Type;

/** Turns a point about the z axis and then the y axis, by angles in radians. */
function turn(point: Point, aboutZ: number, aboutY: number): Point {
  const [x, y, z] = point;
  const zx = x * Math.cos(aboutZ) - y * Math.sin(aboutZ);
  const zy = x * Math.sin(aboutZ) + y * Math.cos(aboutZ);
  return [
    zx * Math.cos(aboutY) + z * Math.sin(aboutY),
    zy,
    -zx * Math.sin(aboutY) + z * Math.cos(aboutY),
  ];
}

/** How far a molecule reaches from its middle, in scene units. */
function reachOf(atoms: Placed["atoms"]) {
  return Arr.reduce(atoms, 0.4, (reach, atom) =>
    Math.max(reach, length(atom.position))
  );
}

/**
 * Lays one side's molecules out in a grid about `middle`: one cell per
 * molecule, wide enough for the largest, each molecule turned a little
 * differently so the side reads as a real jostling gas, not a row of copies.
 */
function layoutSide(terms: readonly (readonly [MoleculeId, number])[]) {
  return Result.gen(function* () {
    let molecules: readonly Placed[] = [];
    for (const [id, coefficient] of terms) {
      const molecule = yield* getMolecule(id);
      molecules = Arr.appendAll(
        molecules,
        Arr.makeBy(coefficient, () => molecule)
      );
    }
    const reach = Arr.reduce(molecules, 0.4, (largest, molecule) =>
      Math.max(largest, reachOf(molecule.atoms))
    );
    const cell = 2 * reach + MOLECULE_GAP;
    const columns = Math.ceil(Math.sqrt(molecules.length));
    const rows = Math.ceil(molecules.length / columns);
    const placed = Arr.map(molecules, (molecule, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const offset: Point = [
        (column - (columns - 1) / 2) * cell,
        ((rows - 1) / 2 - row) * cell,
        0,
      ];
      return {
        atoms: Arr.map(molecule.atoms, (atom) => {
          const turned = turn(atom.position, 0.7 * index, 0.45 * index);
          return {
            element: atom.element,
            position: [
              turned[0] + offset[0],
              turned[1] + offset[1],
              turned[2] + offset[2],
            ] satisfies Point,
          };
        }),
        bonds: molecule.bonds,
      };
    });
    return { columns, molecules: placed, width: columns * cell };
  });
}

/** Moves every atom of a side across by `shift` along x. */
function shiftSide(molecules: readonly Placed[], shift: number) {
  return Arr.map(molecules, (molecule) => ({
    atoms: Arr.map(molecule.atoms, (atom) => ({
      element: atom.element,
      position: [
        atom.position[0] + shift,
        atom.position[1],
        atom.position[2],
      ] satisfies Point,
    })),
    bonds: molecule.bonds,
  }));
}

/** Flattens a side's molecules into one list of atoms and of bonds between them. */
function flatten(molecules: readonly Placed[]) {
  let atoms: Placed["atoms"] = [];
  let bonds: readonly Bond[] = [];
  for (const molecule of molecules) {
    const start = atoms.length;
    bonds = Arr.appendAll(
      bonds,
      Arr.map(molecule.bonds, (bond) => ({
        ...bond,
        from: bond.from + start,
        to: bond.to + start,
      }))
    );
    atoms = Arr.appendAll(atoms, molecule.atoms);
  }
  return { atoms, bonds };
}

/** Orders atoms from the top of a side down, then from left to right. */
const topDown = Order.combine(
  Order.mapInput(
    Order.flip(Order.Number),
    (entry: typeof AtomSchema.Type) => entry.position[1]
  ),
  Order.mapInput(
    Order.Number,
    (entry: typeof AtomSchema.Type) => entry.position[0]
  )
);

/** A reaction whose two sides do not hold the same atoms. */
export class ReactionBalanceError extends Data.TaggedError(
  "ReactionBalanceError"
) {}

/**
 * The whole reaction laid out for the lab: the reactants on the left, the
 * products on the right, and every atom's path from its place in a reactant
 * to its place in a product. Atoms of one element pair up from the top of each
 * side down, so they cross over as little as they can. Particle `i` is
 * reactant atom `i`, so the reactant bonds name particles as they are, and
 * each product bond is renamed to the particles that end in it.
 */
export function layoutReaction(reaction: ReturnType<typeof getReaction>) {
  return Result.gen(function* () {
    const left = yield* layoutSide(reaction.reactants);
    const right = yield* layoutSide(reaction.products);
    const reactants = flatten(
      shiftSide(left.molecules, -(left.width / 2 + ARROW_ROOM))
    );
    const products = flatten(
      shiftSide(right.molecules, right.width / 2 + ARROW_ROOM)
    );
    if (reactants.atoms.length !== products.atoms.length) {
      return yield* Result.fail(new ReactionBalanceError());
    }
    const ordered = (side: typeof reactants) =>
      Arr.sort(
        Arr.map(side.atoms, (atom, index) => ({ ...atom, index })),
        topDown
      );
    const fromProducts = ordered(products);
    let pairs: readonly Particle[] = [];
    for (const atom of ordered(reactants)) {
      const partner = Arr.findFirst(
        fromProducts,
        (candidate) =>
          candidate.element === atom.element &&
          !Arr.some(pairs, (pair) => pair.product === candidate.index)
      );
      if (Option.isNone(partner)) {
        return yield* Result.fail(new ReactionBalanceError());
      }
      pairs = Arr.append(pairs, {
        element: atom.element,
        end: partner.value.position,
        product: partner.value.index,
        reactant: atom.index,
        start: atom.position,
      });
    }
    const particles = Arr.sort(
      pairs,
      Order.mapInput(Order.Number, (pair: Particle) => pair.reactant)
    );
    // Every product atom is paired exactly once, so sorted by product atom
    // the pairs name, at each product index, the particle that ends there.
    const particleOf = Arr.map(
      Arr.sort(
        pairs,
        Order.mapInput(Order.Number, (pair: Particle) => pair.product)
      ),
      (pair) => pair.reactant
    );
    const productBonds = Arr.map(products.bonds, (bond) => ({
      ...bond,
      from: Arr.getUnsafe(particleOf, bond.from),
      to: Arr.getUnsafe(particleOf, bond.to),
    }));
    return {
      particles,
      productBonds,
      reactantBonds: reactants.bonds,
      span: left.width + right.width + 2 * ARROW_ROOM,
    };
  });
}
