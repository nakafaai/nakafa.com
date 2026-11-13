import { Array as Arr, Schema } from "effect";

/** The metal and nonmetal pairs an ion lab can join. */
export const PairIdSchema = Schema.Literals([
  "sodium-chlorine",
  "magnesium-oxygen",
  "lithium-fluorine",
  "potassium-chlorine",
]);
export type PairId = typeof PairIdSchema.Type;

/** One atom before and after it becomes an ion. */
const AtomSchema = Schema.Struct({
  /** The atom's radius in picometres: metallic for a metal, covalent for a nonmetal. */
  atomic: Schema.Finite,
  /** The six-coordinate radius of its ion in picometres (Shannon 1976). */
  ionic: Schema.Finite,
  /** Electrons in each shell of the neutral atom, from K outward. */
  shells: Schema.Array(Schema.Int),
  symbol: Schema.Literals(["Li", "Na", "K", "Mg", "F", "O", "Cl"]),
});
export type IonAtom = typeof AtomSchema.Type;

const PairSchema = Schema.Struct({
  electrons: Schema.Int,
  metal: AtomSchema,
  nonmetal: AtomSchema,
});

const ATOMS = {
  Cl: { atomic: 102, ionic: 181, shells: [2, 8, 7], symbol: "Cl" },
  F: { atomic: 57, ionic: 133, shells: [2, 7], symbol: "F" },
  K: { atomic: 227, ionic: 138, shells: [2, 8, 8, 1], symbol: "K" },
  Li: { atomic: 152, ionic: 76, shells: [2, 1], symbol: "Li" },
  Mg: { atomic: 160, ionic: 72, shells: [2, 8, 2], symbol: "Mg" },
  Na: { atomic: 186, ionic: 102, shells: [2, 8, 1], symbol: "Na" },
  O: { atomic: 66, ionic: 140, shells: [2, 6], symbol: "O" },
} as const satisfies Record<IonAtom["symbol"], IonAtom>;

/**
 * Each pair and how many electrons pass from the metal to the nonmetal:
 * metallic radii from the CRC Handbook, covalent radii from Cordero et al.
 * (2008), ionic radii from Shannon (1976).
 */
const PAIRS = {
  "lithium-fluorine": { electrons: 1, metal: ATOMS.Li, nonmetal: ATOMS.F },
  "magnesium-oxygen": { electrons: 2, metal: ATOMS.Mg, nonmetal: ATOMS.O },
  "potassium-chlorine": { electrons: 1, metal: ATOMS.K, nonmetal: ATOMS.Cl },
  "sodium-chlorine": { electrons: 1, metal: ATOMS.Na, nonmetal: ATOMS.Cl },
} as const satisfies Record<PairId, typeof PairSchema.Type>;

/** The metal, the nonmetal and the electrons that pass between them. */
export function getPair(id: PairId): typeof PairSchema.Type {
  return PAIRS[id];
}

/** The shells after `electrons` leave the outermost shell, which empties for an ion. */
export function shellsAfterLoss(shells: readonly number[], electrons: number) {
  const outer = Arr.last(shells).pipe((last) =>
    last._tag === "Some" ? last.value : 0
  );
  const kept = Arr.dropRight(shells, 1);
  return outer - electrons > 0 ? Arr.append(kept, outer - electrons) : kept;
}

/** The shells after `electrons` join the outermost shell. */
export function shellsAfterGain(shells: readonly number[], electrons: number) {
  return Arr.map(shells, (count, index) =>
    index === shells.length - 1 ? count + electrons : count
  );
}

/** A configuration as math: "2,8,1". */
export function shellsTex(shells: readonly number[]) {
  return Arr.join(Arr.map(shells, String), ",");
}

/** The ion's symbol with its charge as math: "\mathrm{Mg^{2+}}". */
export function ionTex(symbol: string, charge: number) {
  const size = Math.abs(charge) === 1 ? "" : `${Math.abs(charge)}`;
  const sign = charge > 0 ? "+" : "-";
  return `\\mathrm{${symbol}^{${size}${sign}}}`;
}
