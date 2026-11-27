import type { Point } from "@repo/design-system/components/three/molecule/point";
import {
  add,
  aside,
  cross,
  length,
  scale,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";
import type { Molecule } from "@repo/design-system/components/three/molecule/shape";
import type { Join } from "@repo/design-system/components/three/molecule/sugar";
import { glycanOf } from "@repo/design-system/components/three/molecule/sugar";
import { Array as Arr, Match, Schema } from "effect";

export const SUGARS = ["maltose", "sucrose", "lactose"] as const;
export const POLYSACCHARIDES = ["starch", "glycogen", "cellulose"] as const;
const MONOMERS = ["glucose", "fructose", "galactose"] as const;
export const REACTIONS = ["condensation", "hydrolysis"] as const;
export const SCALES = ["pair", "chain"] as const;

const SugarSchema = Schema.Literals(SUGARS);
const PolysaccharideSchema = Schema.Literals(POLYSACCHARIDES);
const MonomerSchema = Schema.Literals(MONOMERS);
const ReactionSchema = Schema.Literals(REACTIONS);
const ScaleSchema = Schema.Literals(SCALES);

export type Sugar = typeof SugarSchema.Type;
export type Polysaccharide = typeof PolysaccharideSchema.Type;
export type Monomer = typeof MonomerSchema.Type;
export type Reaction = typeof ReactionSchema.Type;
export type Scale = typeof ScaleSchema.Type;

/**
 * The glycosidic bonds of the lesson with their torsions in degrees. The
 * alpha 1,4 bond of starch and glycogen winds a chain into the left-handed
 * helix of amylose, six glucose units a turn; the beta 1,4 bond of
 * cellulose turns each unit half a turn from the last, a flat ribbon that
 * rises 5.3 angstrom a unit, as in the fibre; the alpha 1,6 bond starts a
 * branch.
 */
const HELIX = { anomer: "alpha", oxygen: "O4", phi: 80, psi: 130 } as const;
const RIBBON = { anomer: "beta", oxygen: "O4", phi: -98, psi: 98.5 } as const;
const BRANCH = { anomer: "alpha", oxygen: "O6", phi: 70, psi: 140 } as const;

/**
 * Where the neighbouring chain of a cellulose sheet lies, in angstrom:
 * beside the chain in the plane of its rings and a little above it, as near
 * as the idealised chairs let two chains come, so that hydroxyls of the two
 * reach each other; and how near two of their oxygens must be to share a
 * hydrogen bond.
 */
const SHEET = 7.25;
const STEP = 1.5;
const HYDROGEN_BOND = 3.3;

/** The two monosaccharides that join to form each disaccharide. */
export function monomersOf(sugar: Sugar): readonly [Monomer, Monomer] {
  return Match.value(sugar).pipe(
    Match.when("maltose", () => ["glucose", "glucose"] as const),
    Match.when("sucrose", () => ["glucose", "fructose"] as const),
    Match.when("lactose", () => ["glucose", "galactose"] as const),
    Match.exhaustive
  );
}

/** Number of glycosidic bonds (and water molecules released/used) for `units` monomers. */
export function bondCount(units: number): number {
  return Math.max(0, Math.round(units) - 1);
}

/**
 * A disaccharide as its real atoms, with the two sugars it is made of in
 * the order `monomersOf` names them. Maltose is glucose alpha 1,4 glucose,
 * lactose galactose beta 1,4 glucose, and sucrose glucose alpha 1 to beta 2
 * fructose, whose fructose is a five-membered ring. `first` and `second`
 * are those sugars whole, as hydrolysis releases them, `bridge` the oxygen
 * of the glycosidic bond and `centers` the middles of the two rings.
 */
export function pairOf(sugar: Sugar) {
  const { flipped, glycan } = Match.value(sugar).pipe(
    Match.when("maltose", () => ({
      flipped: false,
      glycan: glycanOf({ anomer: "beta", unit: "glucose" }, [
        { ...HELIX, host: 0, unit: "glucose" },
      ]),
    })),
    Match.when("lactose", () => ({
      flipped: false,
      glycan: glycanOf({ anomer: "beta", unit: "glucose" }, [
        { ...RIBBON, host: 0, unit: "galactose" },
      ]),
    })),
    Match.when("sucrose", () => ({
      flipped: true,
      glycan: glycanOf({ anomer: "beta", unit: "fructose" }, [
        {
          anomer: "alpha",
          host: 0,
          oxygen: "O2",
          phi: 105,
          psi: -15,
          unit: "glucose",
        },
      ]),
    })),
    Match.exhaustive
  );
  const ends = <Value>(values: Arr.NonEmptyReadonlyArray<Value>) =>
    flipped
      ? ([Arr.lastNonEmpty(values), Arr.headNonEmpty(values)] as const)
      : ([Arr.headNonEmpty(values), Arr.lastNonEmpty(values)] as const);
  const [first, second] = ends(glycan.free);
  return {
    bridge: Arr.reduce(
      glycan.bridges,
      Arr.headNonEmpty(glycan.centers),
      (_, bridge) => bridge
    ),
    centers: ends(glycan.centers),
    first,
    molecule: glycan.molecule,
    second,
  };
}

/**
 * How each glucose after the first joins a polysaccharide of `units` units.
 * Starch is one helix and cellulose one ribbon. Glycogen is a helix that
 * branches: every fourth unit starts a branch on carbon 6 of the unit before
 * the chain's end, the unit after it lengthens that branch, and the others
 * lengthen the main chain.
 */
export function joinsOf(
  polysaccharide: Polysaccharide,
  units: number
): readonly Join[] {
  const count = Math.max(2, Math.round(units));
  if (polysaccharide !== "glycogen") {
    const bond = polysaccharide === "starch" ? HELIX : RIBBON;
    return Arr.makeBy(count - 1, (index) => ({
      ...bond,
      host: index,
      unit: "glucose" as const,
    }));
  }
  return Arr.reduce(
    Arr.range(1, count - 1),
    { before: 0, joins: Arr.empty<Join>(), tip: 0 },
    (grown, index) => {
      if (index > 2 && index % 4 === 0) {
        return {
          ...grown,
          joins: [
            ...grown.joins,
            { ...BRANCH, host: grown.before, unit: "glucose" as const },
          ],
        };
      }
      if (index > 4 && index % 4 === 1) {
        return {
          ...grown,
          joins: [
            ...grown.joins,
            { ...HELIX, host: index - 1, unit: "glucose" as const },
          ],
        };
      }
      return {
        before: grown.tip,
        joins: [
          ...grown.joins,
          { ...HELIX, host: grown.tip, unit: "glucose" as const },
        ],
        tip: index,
      };
    }
  ).joins;
}

/** A molecule with every atom moved by `by`, and its parts numbered from `first`. */
function shifted(molecule: Molecule, by: Point, first: number): Molecule {
  return {
    atoms: Arr.map(molecule.atoms, (atom) => ({
      ...atom,
      at: add(atom.at, by),
      part: atom.part + first,
    })),
    bonds: molecule.bonds,
    ties: [],
    traces: [],
  };
}

/**
 * A polysaccharide of `units` glucose units as its real atoms. `molecule`
 * is the chain the lab counts, unit `n` its part `n`; `bridges` are the
 * oxygens of its glycosidic bonds and `centers` the middles of its rings.
 * Cellulose comes with `beside`, the neighbouring chain of its sheet with
 * parts numbered after the chain's, and `ties`, the hydrogen bonds between
 * the two; for the other two `beside` is the chain itself and no bond ties
 * it.
 */
export function chainOf(polysaccharide: Polysaccharide, units: number) {
  const glycan = glycanOf(
    {
      anomer: polysaccharide === "cellulose" ? "beta" : "alpha",
      unit: "glucose",
    },
    joinsOf(polysaccharide, units)
  );
  if (polysaccharide !== "cellulose") {
    return { ...glycan, beside: glycan.molecule, ties: [] };
  }
  const along = unit(
    sub(Arr.lastNonEmpty(glycan.centers), Arr.headNonEmpty(glycan.centers))
  );
  const above = aside(along, [0, 0, 1]);
  const beside = shifted(
    glycan.molecule,
    add(scale(cross(along, above), SHEET), scale(above, STEP)),
    glycan.centers.length
  );
  const oxygens = (molecule: Molecule) =>
    Arr.filter(molecule.atoms, (atom) => atom.element === "O");
  return {
    ...glycan,
    beside,
    ties: Arr.flatMap(oxygens(glycan.molecule), (near) =>
      Arr.map(
        Arr.filter(
          oxygens(beside),
          (far) => length(sub(far.at, near.at)) < HYDROGEN_BOND
        ),
        (far) => [near.at, far.at] as const
      )
    ),
  };
}
