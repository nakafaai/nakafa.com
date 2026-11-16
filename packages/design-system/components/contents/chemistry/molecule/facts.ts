import {
  AngleSchema,
  countAtoms,
  type MoleculeId,
  relativeMass,
} from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import {
  ELEMENTS,
  type ElementSymbol,
} from "@repo/design-system/components/contents/chemistry/molecule/elements";
import {
  AtomSchema,
  measureAngle,
  measureDistance,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Array as Arr, Option, Schema } from "effect";

/** Writes a number for math in the reader's language, such as "35{,}5". */
export type MathNumber = (value: number) => string;

/** The atoms of a molecule as math: "2\,\mathrm{H},\ 1\,\mathrm{O}". */
export function compositionTex(id: MoleculeId) {
  return Arr.join(
    Arr.map(
      countAtoms(id),
      ([element, count]) => `${count}\\,\\mathrm{${element}}`
    ),
    ",\\ "
  );
}

/** One element's share of a relative molecular mass: "2(1)" or "16". */
function massTerm(element: ElementSymbol, count: number, format: MathNumber) {
  const mass = format(ELEMENTS[element].mass);
  return count === 1 ? mass : `${count}(${mass})`;
}

/** The relative molecular mass summed from its atoms: "M_r = 2(1) + 16 = 18". */
export function massTex(id: MoleculeId, format: MathNumber) {
  const terms = Arr.map(countAtoms(id), ([element, count]) =>
    massTerm(element, count, format)
  );
  return `M_r = ${Arr.join(terms, " + ")} = ${format(relativeMass(id))}`;
}

/** The atoms a shape reading measures, and the angle it reads when it has one. */
const ShapeSourceSchema = Schema.Struct({
  angle: Schema.optional(Schema.UndefinedOr(AngleSchema)),
  atoms: Schema.Array(AtomSchema),
});

/**
 * The shape reading of a molecule, measured from the drawn atoms: its teaching
 * bond angle, such as "\angle\,\mathrm{HOH} = 104{,}5^\circ", or, for a
 * molecule of two atoms, its bond length in picometres.
 */
export function shapeTex(
  molecule: typeof ShapeSourceSchema.Type,
  format: MathNumber
) {
  const atom = (index: number) => Arr.get(molecule.atoms, index);
  if (molecule.angle === undefined) {
    return Option.map(
      Option.all([atom(0), atom(1)]),
      ([first, second]) =>
        `\\mathrm{${first.element}{-}${second.element}} = ${format(
          measureDistance(first.position, second.position)
        )}\\ \\mathrm{pm}`
    );
  }
  const { arms, vertex } = molecule.angle;
  return Option.map(
    Option.all([atom(arms[0]), atom(vertex), atom(arms[1])]),
    ([first, middle, last]) =>
      `\\angle\\,\\mathrm{${first.element}${middle.element}${last.element}} = ${format(
        measureAngle(first.position, middle.position, last.position)
      )}^\\circ`
  );
}
