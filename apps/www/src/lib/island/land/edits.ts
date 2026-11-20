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
import { chunkOver, heightAt } from "@/lib/island/land/ground";

/** The farthest a stored lift moves a lattice point either way, in eighths of a block. */
const LIFT_LIMIT = 127;

/** The key of the chunk that holds a lattice point. */
function keyOver(i: number, j: number) {
  return keyOf(Math.floor(i / CHUNK), Math.floor(j / CHUNK));
}

/** The lifts of the chunk that holds a lattice point, made when the learner has moved nothing there yet. */
function liftsOver(land: Land, i: number, j: number) {
  const key = keyOver(i, j);
  return Option.getOrElse(MutableHashMap.get(land.lifts, key), () => {
    const lifts = new Int8Array(POINTS);
    MutableHashMap.set(land.lifts, key, lifts);
    return lifts;
  });
}

/** The paints of the chunk that holds a lattice point, made when the learner has painted nothing there yet. */
function paintsOver(land: Land, i: number, j: number) {
  const key = keyOver(i, j);
  return Option.getOrElse(MutableHashMap.get(land.paints, key), () => {
    const paints = new Uint8Array(POINTS);
    MutableHashMap.set(land.paints, key, paints);
    return paints;
  });
}

/**
 * Clears the wild plant rooted at a lattice point for good (ADR 0050, W3), and
 * answers whether one still grew there as far as the world knew.
 */
export function clear(land: Land, i: number, j: number) {
  const key = keyOver(i, j);
  const clears = Option.getOrElse(MutableHashMap.get(land.clears, key), () => {
    const made = new Uint8Array(POINTS);
    MutableHashMap.set(land.clears, key, made);
    return made;
  });
  const index = indexOf(i, j);
  const fresh = clears[index] === 0;
  clears[index] = 1;
  return fresh;
}

/**
 * Moves the ground at one lattice point up or down by eighths of a block
 * (ADR 0050, W2 and W3) and answers by how many it moved: less than asked once
 * the point is as far from the seed's own ground as a world stores.
 */
export function lift(land: Land, i: number, j: number, eighths: number) {
  const lifts = liftsOver(land, i, j);
  const index = indexOf(i, j);
  const next = Math.min(
    LIFT_LIMIT,
    Math.max(-LIFT_LIMIT, lifts[index] + Math.round(eighths))
  );
  const moved = next - lifts[index];
  lifts[index] = next;
  chunkOver(land, i, j).heights[index] += moved / LIFT_STEPS;
  return moved;
}

/**
 * Paints the surface of one lattice point and answers whether it changed. A
 * pond digs into the ground, so painting over one grows its chunk again from
 * the seed and the learner's other changes.
 */
export function paint(land: Land, i: number, j: number, kind: number) {
  const paints = paintsOver(land, i, j);
  const index = indexOf(i, j);
  const before = paints[index];
  if (before === kind) {
    return false;
  }
  paints[index] = kind;
  if (before === PAINT.pond) {
    MutableHashMap.remove(land.chunks, keyOver(i, j));
    return true;
  }
  paintOver(chunkOver(land, i, j), index, kind);
  return true;
}

/**
 * Levels the ground under a building (ADR 0050, W2): every lattice point
 * inside the rectangle comes to the mean height of the points it held, and
 * the points one block outside come halfway, so the building stands on a
 * terrace that eases into the land. It answers that height, or the ground's
 * own at the middle when the rectangle holds no lattice point.
 */
export function level(
  land: Land,
  from: readonly [number, number],
  to: readonly [number, number]
) {
  let sum = 0;
  let count = 0;
  for (let j = Math.ceil(from[1]); j <= Math.floor(to[1]); j += 1) {
    for (let i = Math.ceil(from[0]); i <= Math.floor(to[0]); i += 1) {
      sum += heightAt(land, i, j);
      count += 1;
    }
  }
  if (count === 0) {
    return heightAt(land, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  }
  const mean = sum / count;
  for (let j = Math.floor(from[1]) - 1; j <= Math.ceil(to[1]) + 1; j += 1) {
    for (let i = Math.floor(from[0]) - 1; i <= Math.ceil(to[0]) + 1; i += 1) {
      const inside = i >= from[0] && i <= to[0] && j >= from[1] && j <= to[1];
      const share = inside ? 1 : 0.5;
      lift(land, i, j, (mean - heightAt(land, i, j)) * share * LIFT_STEPS);
    }
  }
  return mean;
}
