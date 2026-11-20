import type { Place } from "@repo/design-system/components/contents/mathematics/counterexample/layout";
import { Option, Schema } from "effect";

/**
 * The clock of one check of every case. Playing checks the tiles one by one
 * in reading order: each tile shows what it does to the claim, or on the case
 * board is carried to the cell of its case. The stamp on the claim card comes
 * down once the claim is settled: at the first counterexample of "all" or
 * "if", at the first example of "some", and otherwise only after the last
 * tile, because only every case together shows that no counterexample, or no
 * example, exists.
 */

/** A point above the board, in metres. */
const PointSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
});

/** Seconds before the first tile is checked. */
const LEAD = 0.4;

/** Seconds from one tile's check to the next one's. */
const STEP = 0.5;

/** Seconds one tile's check takes. */
const CHECK = 0.42;

/** Seconds the stamp takes to come down. */
const STAMP = 0.24;

/** How high a carried tile rises at the middle of its path, in metres. */
const ARC = 0.05;

/** Eases a fraction of a move in and out. */
function ease(fraction: number) {
  const t = Math.min(1, Math.max(0, fraction));
  return t * t * (3 - 2 * t);
}

/** When the check of one tile starts, in seconds from the start. */
function startOf(index: number) {
  return LEAD + index * STEP;
}

/** When the check of `count` tiles ends, in seconds from the start. */
export function sweepEnd(count: number) {
  return startOf(Math.max(0, count - 1)) + CHECK;
}

/** How far the check of one tile has come at `time`, from 0 before it starts to 1 once it is done. */
export function checkedAt(time: number, index: number) {
  return ease((time - startOf(index)) / CHECK);
}

/** The tile being checked at `time`, while one is. */
export function activeAt(time: number, count: number) {
  const index = Math.floor((time - LEAD) / STEP);
  return index >= 0 && index < count && time - startOf(index) < CHECK
    ? Option.some(index)
    : Option.none();
}

/**
 * How far the stamp has come down at `time`, from 0 to 1. It comes down as
 * the check of the tile that settles the claim ends, or, when no tile settles
 * it, as the check of the last tile ends.
 */
export function stampAt(
  time: number,
  decider: Option.Option<number>,
  count: number
) {
  const settled = Option.match(decider, {
    onNone: () => sweepEnd(count),
    onSome: (index) => startOf(index) + CHECK,
  });
  return ease((time - settled) / STAMP);
}

/**
 * Where a tile carried from one spot to another is at `fraction` of its
 * path, rising in an arc between them: a short move arcs low, and a tile
 * that stays where it is does not rise at all.
 */
export function carryAt(
  from: Place,
  to: Place,
  fraction: number
): typeof PointSchema.Type {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  return {
    x: from.x + (to.x - from.x) * fraction,
    y: Math.min(ARC, distance / 2) * Math.sin(Math.PI * fraction),
    z: from.z + (to.z - from.z) * fraction,
  };
}
