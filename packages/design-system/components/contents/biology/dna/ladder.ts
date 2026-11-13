import {
  backboneAt,
  HELIX,
  isCopied,
  isOpen,
} from "@repo/design-system/components/contents/biology/dna/strand";
import { Array as Arr, Schema } from "effect";

/** A point in nanometres. */
export const PointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Point = typeof PointSchema.Type;

/**
 * One base pair's place in the drawing: the two parent backbones, and, once
 * the polymerase has passed, the two new backbones that pair with them.
 */
export const RungSchema = Schema.Struct({
  copied: Schema.Boolean,
  first: PointSchema,
  index: Schema.Finite,
  newFirst: PointSchema,
  newSecond: PointSchema,
  open: Schema.Boolean,
  second: PointSchema,
});
export type Rung = typeof RungSchema.Type;

/** How far apart a parent and its new partner stand once copied, in nanometres. */
const PAIR_GAP = 1.1;

/**
 * Where every base pair of a `count` long stretch stands, with the axis along
 * x. Below the fork the strands twist as B-DNA; past it, at a copying
 * progress of `share`, helicase has pulled the two parents apart, more the
 * farther from the fork, and the polymerase lays a new partner beside each
 * parent two base pairs behind it.
 */
export function ladderOf(count: number, share: number): readonly Rung[] {
  if (count <= 0) {
    return [];
  }
  const fork = count * (1 - share);
  return Arr.map(Arr.range(0, count - 1), (index) => {
    const open = isOpen(index, count, share);
    const copied = isCopied(index, count, share);
    const x = index * HELIX.rise;
    if (!open) {
      return {
        copied,
        first: alongX(backboneAt(index, 0)),
        index,
        newFirst: alongX(backboneAt(index, 0)),
        newSecond: alongX(backboneAt(index, 1)),
        open,
        second: alongX(backboneAt(index, 1)),
      };
    }
    const spread = Math.min(2.6, 1 + 0.35 * (index - fork));
    return {
      copied,
      first: [x, spread, 0] as const,
      index,
      newFirst: [x, spread - PAIR_GAP, 0] as const,
      newSecond: [x, -spread + PAIR_GAP, 0] as const,
      open,
      second: [x, -spread, 0] as const,
    };
  });
}

/** Turns a helix point built up the y axis to lie along x. */
function alongX([x, y, z]: readonly [number, number, number]): Point {
  return [y, x, z];
}
