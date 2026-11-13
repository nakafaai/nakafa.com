import { Array as Arr } from "effect";
import { type Ink, rowsTile } from "@/lib/island/tiles/paint";

/**
 * The villagers (ADR 0047, D10): animals two blocks tall, drawn facing the
 * viewer as a top tile (ears and face) over a bottom tile (shirt, trousers and
 * boots), at the blocks' own sixteen pixels a block. Each row below is the
 * left half of a symmetric row; its right half is its mirror.
 */
const FACE = [
  "..offfff",
  ".offffff",
  ".offffff",
  ".offkkff",
  ".offkkff",
  ".offffww",
  ".offwwwp",
  "..offwww",
  "...ooooo",
  "....osss",
] as const;

/** The shirt with an arm at each side, and the trousers to the knee. */
const BODY = [
  "...ossss",
  "..osssss",
  ".ofossss",
  ".ofossss",
  ".ofossss",
  ".offosss",
  "..oossss",
  "...ollll",
  "...ollll",
  "...ollll",
] as const;

/** Legs apart, standing. */
const STAND = [
  "...ollo.",
  "...ollo.",
  "...obbo.",
  "...obbo.",
  "...oooo.",
  "........",
] as const;

/** Legs together, mid-stride. */
const STRIDE = [
  "....oll.",
  "....oll.",
  "....obb.",
  "....obb.",
  "....ooo.",
  "........",
] as const;

/** Each villager's ears over the shared face, and the colors of their fur, muzzle and shirt. */
const KINDS = {
  bear: {
    ears: [
      "........",
      "........",
      "........",
      "..ooo...",
      ".ofpfo..",
      ".offfooo",
    ],
    fur: ["bark", 2],
    muzzle: ["sand", 2],
    shirt: ["bloom", 2],
  },
  cat: {
    ears: [
      "........",
      "........",
      "..o.....",
      "..oo....",
      "..ofo...",
      "..ofpooo",
    ],
    fur: ["wood", 2],
    muzzle: ["plaster", 3],
    shirt: ["leaf", 2],
  },
  fox: {
    ears: [
      "........",
      "........",
      "..o.....",
      "..oo....",
      "..ofo...",
      "..ofpooo",
    ],
    fur: ["ginger", 2],
    muzzle: ["plaster", 3],
    shirt: ["sky", 2],
  },
  rabbit: {
    ears: [
      "...oo...",
      "..ofpo..",
      "..ofpo..",
      "..ofpo..",
      "..ofpo..",
      "..offooo",
    ],
    fur: ["plaster", 1],
    muzzle: ["plaster", 3],
    shirt: ["slate", 2],
  },
} as const;

/** The kind of a villager. */
type Folk = keyof typeof KINDS;

/** A row from its left half and that half's mirror. */
function mirrorOf(half: string) {
  return half + Arr.join(Arr.reverse(Arr.fromIterable(half)), "");
}

/** The colors one villager is drawn in, by the characters of their rows. */
function legendOf(folk: Folk): Readonly<Record<string, Ink>> {
  const kind = KINDS[folk];
  return {
    b: ["ink", 1],
    f: kind.fur,
    k: ["ink", 0],
    l: ["bark", 1],
    o: ["ink", 0],
    p: ["petal", 2],
    s: kind.shirt,
    w: kind.muzzle,
  };
}

/** A villager's head: their ears and face. */
export function folkTopTile(folk: Folk) {
  return rowsTile(
    Arr.map([...KINDS[folk].ears, ...FACE], mirrorOf),
    legendOf(folk)
  );
}

/** A villager's body standing, or mid-stride when `stride`. */
export function folkBottomTile(folk: Folk, stride: boolean) {
  return rowsTile(
    Arr.map([...BODY, ...(stride ? STRIDE : STAND)], mirrorOf),
    legendOf(folk)
  );
}
