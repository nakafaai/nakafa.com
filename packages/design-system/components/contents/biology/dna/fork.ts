import type {
  Base,
  Nucleic,
} from "@repo/design-system/components/contents/biology/dna/strand";
import {
  complementOf,
  isCopied,
  isOpen,
} from "@repo/design-system/components/contents/biology/dna/strand";
import {
  HELIX_RISE,
  HELIX_TURN,
  StepSchema,
} from "@repo/design-system/components/three/molecule/nucleic";
import { Array as Arr, Schema } from "effect";

/**
 * How far helicase has pulled each parent strand from the old axis once the
 * fork is well behind, in angstrom: far enough that the two daughter helices,
 * each 20 angstrom across, stand clear of each other.
 */
export const SPREAD = 14;

/** Over how many base pairs past the fork the strands reach their full spread. */
const REACH = 5;

/**
 * One drawn molecule of a stretch that is being copied: its steps along the
 * helix, the index of the base pair its first step stands for, and, for each
 * backbone a ribbon draws of it in order, whether that backbone is newly laid.
 */
const DuplexSchema = Schema.Struct({
  fresh: Schema.Array(Schema.Boolean),
  start: Schema.Finite,
  steps: Schema.Array(StepSchema),
});
type Duplex = typeof DuplexSchema.Type;

/**
 * How far base pair `index` of `count` is pushed from the old axis at a
 * copying progress of `share`, in angstrom: nothing below the fork, then an
 * eased opening that reaches the full spread a few pairs past it.
 */
export function spreadAt(index: number, count: number, share: number) {
  if (!isOpen(index, count, share)) {
    return 0;
  }
  const past = Math.min(1, (index - count * (1 - share) + 1) / REACH);
  return SPREAD * past * past * (3 - 2 * past);
}

/**
 * The molecules of a stretch of `bases` at a copying progress of `share`,
 * with every atom in place. Below the fork the two parents twist as one
 * B-form helix. Past it helicase has pulled them apart, and the polymerase,
 * two base pairs behind, lays a new partner on each, so two daughter helices
 * leave the fork: the first parent and its new partner in the first molecule,
 * the second parent and its new partner in the second. An RNA genome is one
 * strand of ribose nucleotides that gains its partner as it is copied, so it
 * is never pulled apart and has no second molecule.
 */
export function forkOf(
  bases: readonly Base[],
  nucleic: Nucleic,
  share: number
): readonly Duplex[] {
  const count = bases.length;
  const single = nucleic === "rna";
  const places = Arr.map(bases, (base, index) => ({
    base,
    copied: isCopied(index, count, share),
    index,
    open: isOpen(index, count, share),
    partner: complementOf(base, nucleic),
    step: {
      rise: index * HELIX_RISE,
      sugar: single ? ("ribose" as const) : ("deoxyribose" as const),
      turn: index * HELIX_TURN,
    },
  }));
  const closed = Arr.filter(places, (place) => !place.open).length;
  const copied = Arr.some(places, (place) => place.copied);
  const upper: Duplex = {
    fresh: [
      false,
      ...(closed > 0 && !single ? [false] : []),
      ...(copied ? [true] : []),
    ],
    start: 0,
    steps: Arr.map(places, (place) => ({
      ...place.step,
      first: place.base,
      second: partnerOf(place, single),
      shift: single ? 0 : spreadAt(place.index, count, share),
    })),
  };
  if (single || closed === count) {
    return count === 0 ? [] : [upper];
  }
  const start = Math.max(0, closed - 1);
  return [
    upper,
    {
      fresh: [...(copied ? [true] : []), false],
      start,
      steps: Arr.map(Arr.drop(places, start), (place) => ({
        ...place.step,
        first: place.copied ? place.base : undefined,
        second: place.partner,
        shift: -spreadAt(place.index, count, share),
      })),
    },
  ];
}

/** The base opposite the first parent at one place: its old partner below the fork, its new one once copied. */
function partnerOf(
  place: Readonly<{ copied: boolean; open: boolean; partner: Base }>,
  single: boolean
) {
  if (place.copied) {
    return place.partner;
  }
  return place.open || single ? undefined : place.partner;
}
