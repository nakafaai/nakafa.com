import { MutableHashMap, Option } from "effect";
import {
  CHUNK,
  indexOf,
  keyOf,
  LIFT_STEPS,
  PAINT,
  POINTS,
  paintOver,
} from "@/lib/island/land/chunk";
import type { Land } from "@/lib/island/land/ground";
import { chunkOver } from "@/lib/island/land/ground";

/** The farthest a stored lift moves a lattice point either way, in eighths of a block (ADR 0050, W3). */
export const LIFT_LIMIT = 127;

/** The key of the chunk that holds a lattice point. */
function keyOver(i: number, j: number) {
  return keyOf(Math.floor(i / CHUNK), Math.floor(j / CHUNK));
}

/** One of the learner's stores of a chunk's changes, made when they have changed nothing of its kind there yet. */
function storeOver<Store extends Int8Array | Uint8Array>(
  stores: MutableHashMap.MutableHashMap<number, Store>,
  key: number,
  make: () => Store
) {
  return Option.getOrElse(MutableHashMap.get(stores, key), () => {
    const made = make();
    MutableHashMap.set(stores, key, made);
    return made;
  });
}

/** How far the learner moved the ground at a lattice point, in eighths of a block. */
export function liftOf(land: Land, i: number, j: number) {
  return Option.match(MutableHashMap.get(land.lifts, keyOver(i, j)), {
    onNone: () => 0,
    onSome: (lifts) => lifts[indexOf(i, j)],
  });
}

/** The surface the learner painted at a lattice point, `PAINT.none` where the land keeps its own. */
export function paintOf(land: Land, i: number, j: number) {
  return Option.match(MutableHashMap.get(land.paints, keyOver(i, j)), {
    onNone: () => PAINT.none,
    onSome: (paints) => paints[indexOf(i, j)],
  });
}

/** Whether the learner cleared the wild plant rooted at a lattice point. */
export function clearedOf(land: Land, i: number, j: number) {
  return Option.match(MutableHashMap.get(land.clears, keyOver(i, j)), {
    onNone: () => false,
    onSome: (clears) => clears[indexOf(i, j)] === 1,
  });
}

/**
 * Sets how far the ground at one lattice point stands from the seed's own, in
 * eighths of a block (ADR 0050, W2 and W3), held to what a world stores.
 */
export function setLift(land: Land, i: number, j: number, eighths: number) {
  const lifts = storeOver(
    land.lifts,
    keyOver(i, j),
    () => new Int8Array(POINTS)
  );
  const index = indexOf(i, j);
  const next = Math.min(LIFT_LIMIT, Math.max(-LIFT_LIMIT, Math.round(eighths)));
  const chunk = chunkOver(land, i, j);
  const moved = (next - lifts[index]) / LIFT_STEPS;
  lifts[index] = next;
  chunk.heights[index] += moved;
}

/**
 * Sets the surface of one lattice point. A pond digs into the ground and
 * keeps the land's own cover, so painting over one, digging one through a
 * painted surface, and taking a surface away each grow the chunk again from
 * the seed and the learner's other changes.
 */
export function setPaint(land: Land, i: number, j: number, kind: number) {
  const key = keyOver(i, j);
  const paints = storeOver(land.paints, key, () => new Uint8Array(POINTS));
  const index = indexOf(i, j);
  const before = paints[index];
  paints[index] = kind;
  const dug = kind === PAINT.pond && before !== PAINT.none;
  if (before === PAINT.pond || kind === PAINT.none || dug) {
    MutableHashMap.remove(land.chunks, key);
    return;
  }
  paintOver(chunkOver(land, i, j), index, kind);
}

/** Clears the wild plant rooted at a lattice point, or lets it grow back. */
export function setCleared(land: Land, i: number, j: number, cleared: boolean) {
  const clears = storeOver(
    land.clears,
    keyOver(i, j),
    () => new Uint8Array(POINTS)
  );
  clears[indexOf(i, j)] = cleared ? 1 : 0;
}
