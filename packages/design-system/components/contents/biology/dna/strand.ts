import { Array as Arr, Equal, Record, Schema, String as Str } from "effect";

/** The bases a nucleic acid strand is written in. */
export const BaseSchema = Schema.Literals(["A", "C", "G", "T", "U"]);
export type Base = typeof BaseSchema.Type;

/** DNA pairs A with T; RNA pairs A with U. */
export const NucleicSchema = Schema.Literals(["dna", "rna"]);
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
export const HELIX = {
  diameter: 2,
  perTurn: 10.5,
  rise: 0.34,
} as const;

/**
 * The second backbone trails the first by 12/34 of a turn, so the grooves
 * between them are 1.2 nm (minor) and 2.2 nm (major) wide along the axis.
 */
export const GROOVE_SHIFT = 12 / 34;

/** The pitch of one full turn, in nanometres. */
export function pitch() {
  return HELIX.rise * HELIX.perTurn;
}

/** The minor and major groove widths along the axis, in nanometres. */
export function grooves() {
  return {
    major: pitch() * (1 - GROOVE_SHIFT),
    minor: pitch() * GROOVE_SHIFT,
  };
}

/** How long a stretch of `count` base pairs is, in nanometres. */
export function spanOf(count: number) {
  return count * HELIX.rise;
}

/** How many full turns a stretch of `count` base pairs makes. */
export function turnsOf(count: number) {
  return count / HELIX.perTurn;
}

/**
 * Where the backbone of `strand` (0 or 1) sits at base pair `index`, in
 * nanometres: up the y axis by the rise, around it by the twist, the second
 * strand a groove's shift behind.
 */
export function backboneAt(index: number, strand: 0 | 1) {
  const angle =
    (index / HELIX.perTurn + (strand === 1 ? GROOVE_SHIFT : 0)) * Math.PI * 2;
  const radius = HELIX.diameter / 2;
  return [
    Math.cos(angle) * radius,
    index * HELIX.rise,
    Math.sin(angle) * radius,
  ] as const;
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

/** The standard genetic code, codon to amino acid, written for DNA. */
const CODE = Record.fromEntries(
  Arr.flatMap(
    [
      ["F", "TTT TTC"],
      ["L", "TTA TTG CTT CTC CTA CTG"],
      ["I", "ATT ATC ATA"],
      ["M", "ATG"],
      ["V", "GTT GTC GTA GTG"],
      ["S", "TCT TCC TCA TCG AGT AGC"],
      ["P", "CCT CCC CCA CCG"],
      ["T", "ACT ACC ACA ACG"],
      ["A", "GCT GCC GCA GCG"],
      ["Y", "TAT TAC"],
      ["*", "TAA TAG TGA"],
      ["H", "CAT CAC"],
      ["Q", "CAA CAG"],
      ["N", "AAT AAC"],
      ["K", "AAA AAG"],
      ["D", "GAT GAC"],
      ["E", "GAA GAG"],
      ["C", "TGT TGC"],
      ["W", "TGG"],
      ["R", "CGT CGC CGA CGG AGA AGG"],
      ["G", "GGT GGC GGA GGG"],
    ] as const,
    ([amino, codons]) =>
      Arr.map(Str.split(codons, " "), (codon) => [codon, amino] as const)
  )
);

/**
 * The amino acid, as its one-letter code, that codon `index` (counted from
 * zero) of a coding strand stands for; none when the strand ends first.
 */
export function aminoAt(bases: readonly Base[], index: number) {
  const codon = Arr.join(
    Arr.map(Arr.take(Arr.drop(bases, index * 3), 3), (base) =>
      base === "U" ? "T" : base
    ),
    ""
  );
  return Record.get(CODE, codon);
}

/** The codon indexes, from zero, where `first` and `second` code differently. */
export function changedCodons(first: readonly Base[], second: readonly Base[]) {
  const codons = Math.floor(Math.min(first.length, second.length) / 3);
  if (codons === 0) {
    return [];
  }
  return Arr.filter(
    Arr.range(0, codons - 1),
    (index) => !Equal.equals(aminoAt(first, index), aminoAt(second, index))
  );
}
