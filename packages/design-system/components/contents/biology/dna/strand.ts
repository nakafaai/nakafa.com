import { Array as Arr, Schema, String as Str } from "effect";

/** The bases a nucleic acid strand is written in. */
const BaseSchema = Schema.Literals(["A", "C", "G", "T", "U"]);
export type Base = typeof BaseSchema.Type;

/** DNA pairs A with T; RNA pairs A with U. */
const NucleicSchema = Schema.Literals(["dna", "rna"]);
export type Nucleic = typeof NucleicSchema.Type;

const isBase = Schema.is(BaseSchema);

/**
 * The bases of an authored sequence, read left to right: letters only, any
 * case, so spaces or codon gaps in the source are ignored. A T in RNA or a U
 * in DNA is written as the strand's own letter.
 */
export function basesOf(text: string, nucleic: Nucleic) {
  return Arr.filter(
    Arr.map(Str.split(Str.toUpperCase(text), ""), (letter) =>
      spelled(letter, nucleic)
    ),
    isBase
  );
}

/** A letter in the strand's own alphabet: RNA writes U where DNA writes T. */
function spelled(letter: string, nucleic: Nucleic) {
  if (nucleic === "rna" && letter === "T") {
    return "U";
  }
  if (nucleic === "dna" && letter === "U") {
    return "T";
  }
  return letter;
}

/** The base that pairs with `base` on the other strand. */
export function complementOf(base: Base, nucleic: Nucleic): Base {
  const partner = { A: "T", C: "G", G: "C", T: "A", U: "A" } as const;
  if (base === "A" && nucleic === "rna") {
    return "U";
  }
  return partner[base];
}

/**
 * B-DNA, the form inside cells, as Watson and Crick (1953) and the fibre
 * measurements of Arnott and Hukins (1972) give it: 0.34 nm between base
 * pairs, 10.5 base pairs to a full turn, 2 nm across.
 */
const HELIX = {
  diameter: 2,
  perTurn: 10.5,
  rise: 0.34,
} as const;

/** How long a stretch of `count` base pairs is, in nanometres. */
export function spanOf(count: number) {
  return count * HELIX.rise;
}

/** How many full turns a stretch of `count` base pairs makes. */
export function turnsOf(count: number) {
  return count / HELIX.perTurn;
}

/** How many positions of `first` and `second` hold different bases. */
export function differencesOf(first: readonly Base[], second: readonly Base[]) {
  return Arr.reduce(
    Arr.zip(first, second),
    0,
    (count, [left, right]) => count + (left === right ? 0 : 1)
  );
}

/** The share of positions where `first` and `second` hold the same base. */
export function identityOf(first: readonly Base[], second: readonly Base[]) {
  const compared = Math.min(first.length, second.length);
  return compared === 0 ? 0 : 1 - differencesOf(first, second) / compared;
}

/** The share of G and C in a strand, which three hydrogen bonds hold. */
export function gcShareOf(bases: readonly Base[]) {
  if (bases.length === 0) {
    return 0;
  }
  return (
    Arr.length(Arr.filter(bases, (base) => base === "G" || base === "C")) /
    bases.length
  );
}

/**
 * Whether base pair `index` of `count` has been opened by the fork at a
 * copying progress of `share`: helicase unzips from the top down.
 */
export function isOpen(index: number, count: number, share: number) {
  return index >= count * (1 - share);
}

/**
 * Whether a new nucleotide already sits opposite base `index`: the
 * polymerase follows the fork two base pairs behind it.
 */
export function isCopied(index: number, count: number, share: number) {
  return index >= count * (1 - share) + 2;
}

/** How many bases the polymerase has copied at a progress of `share`. */
export function copiedCount(count: number, share: number) {
  if (count === 0) {
    return 0;
  }
  return Arr.length(
    Arr.filter(Arr.range(0, count - 1), (index) =>
      isCopied(index, count, share)
    )
  );
}
