import { ELEMENTS } from "@repo/design-system/components/three/molecule/element";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  aside,
  cross,
  ORIGIN,
  scale,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import type {
  Atom,
  Molecule,
} from "@repo/design-system/components/three/molecule/shape";
import { Array as Arr, Option } from "effect";

/** The tetrahedral angle, and the angle around a flat, doubly bonded atom, in radians. */
const TETRAHEDRAL = Math.acos(-1 / 3);
const TRIGONAL = (Math.PI * 2) / 3;

/** Where the hydrogens of an end atom turn to about its one bond: staggered on a tetrahedral atom, in plane on a flat one. */
const STAGGERED = [Math.PI, Math.PI / 3, (Math.PI * 5) / 3] as const;
const IN_PLANE = [Math.PI, 0] as const;

/**
 * The molecule with every hydrogen its heavy atoms leave unwritten: each atom
 * is filled to its element's count of bonds, and each hydrogen stands where
 * the atom's geometry puts it, tetrahedral on a singly bonded atom and in the
 * plane on a doubly bonded atom or on the nitrogen or oxygen beside one, whose
 * lone pair joins the double bond. A
 * hydrogen joins its atom's part.
 */
export function saturate(molecule: Molecule): Molecule {
  const added = Arr.flatMap(molecule.atoms, (atom, index) =>
    Arr.map(hydrogensOf(molecule, atom, index), (at) => ({ at, index }))
  );
  return {
    atoms: [
      ...molecule.atoms,
      ...Arr.flatMap(added, ({ at, index }) =>
        Arr.map(Option.toArray(Arr.get(molecule.atoms, index)), (parent) => ({
          at,
          element: "H" as const,
          part: parent.part,
          spine: parent.spine,
        }))
      ),
    ],
    bonds: [
      ...molecule.bonds,
      ...Arr.map(added, ({ index }, order) => ({
        from: index,
        order: 1 as const,
        to: molecule.atoms.length + order,
      })),
    ],
    ties: molecule.ties,
    traces: molecule.traces,
  };
}

/** The other ends of the bonds of atom `index`, with each bond's order. */
function linksOf(molecule: Molecule, index: number) {
  return Arr.flatMap(molecule.bonds, (bond) => {
    if (bond.from !== index && bond.to !== index) {
      return [];
    }
    const far = bond.from === index ? bond.to : bond.from;
    return Arr.map(Option.toArray(Arr.get(molecule.atoms, far)), (atom) => ({
      atom,
      far,
      order: bond.order,
    }));
  });
}

/** Where the missing hydrogens of one atom stand. */
function hydrogensOf(
  molecule: Molecule,
  atom: Atom,
  index: number
): readonly Point[] {
  const links = linksOf(molecule, index);
  const element = ELEMENTS[atom.element];
  const missing =
    element.bonds - Arr.reduce(links, 0, (sum, link) => sum + link.order);
  const [first, second] = links;
  if (missing <= 0 || first === undefined) {
    return [];
  }
  const place = (direction: Point) =>
    add(atom.at, scale(direction, element.hydrogen));
  if (second === undefined) {
    return Arr.map(endOf(molecule, atom, index, missing), place);
  }
  const arms = Arr.map(links, (link) => unit(sub(link.atom.at, atom.at)));
  const away = unit(
    scale(
      Arr.reduce(arms, ORIGIN, (sum, arm) => add(sum, arm)),
      -1
    )
  );
  if (missing === 1) {
    return [place(away)];
  }
  const normal = unit(
    cross(sub(first.atom.at, atom.at), sub(second.atom.at, atom.at))
  );
  return Arr.map([1, -1], (side) =>
    place(
      add(
        scale(away, Math.cos(TETRAHEDRAL / 2)),
        scale(normal, side * Math.sin(TETRAHEDRAL / 2))
      )
    )
  );
}

/**
 * The directions of the hydrogens on an atom with one bond: a methyl's three,
 * a hydroxyl's one, an amine's two. They turn about that bond against the
 * neighbour's own neighbour, when it has one.
 */
function endOf(
  molecule: Molecule,
  atom: Atom,
  index: number,
  missing: number
): readonly Point[] {
  return Arr.flatMap(Arr.take(linksOf(molecule, index), 1), (link) => {
    const beyond = Arr.filter(
      linksOf(molecule, link.far),
      (next) => next.far !== index
    );
    const flat =
      link.order > 1 ||
      (atom.element !== "C" && Arr.some(beyond, (next) => next.order > 1));
    const axis = unit(sub(atom.at, link.atom.at));
    const toward = Option.match(Arr.head(beyond), {
      onNone: (): Point => [0, 0, 0],
      onSome: (next) => sub(next.atom.at, link.atom.at),
    });
    const side = aside(axis, toward);
    const other = cross(axis, side);
    const angle = flat ? TRIGONAL : TETRAHEDRAL;
    return Arr.map(Arr.take(flat ? IN_PLANE : STAGGERED, missing), (turn) =>
      add(
        scale(axis, -Math.cos(angle)),
        scale(
          add(scale(side, Math.cos(turn)), scale(other, Math.sin(turn))),
          Math.sin(angle)
        )
      )
    );
  });
}
