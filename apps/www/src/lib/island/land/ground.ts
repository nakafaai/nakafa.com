import type { Placed } from "@repo/backend/confect/island/chunk";
import { Array as Arr, MutableHashMap, Option } from "effect";
import type { Chunk } from "@/lib/island/land/chunk";
import { CHUNK, chunkOf, indexOf, keyOf } from "@/lib/island/land/chunk";

/** How far a swimmer's feet hang under the water's face, in blocks. */
const FLOAT = 0.32;

/** The cover a lattice point reads as: what a walker treads on and what grows there. */
export type Cover = "forest" | "grass" | "meadow" | "path" | "sand";

/**
 * A learner's land (ADR 0050, W1 and W3): the seed it grows from, what the
 * learner changed (the lifts, the paints, the cleared wild plants and the
 * things set down in each chunk they touched, by the chunk's key), and the
 * chunks made so far. A chunk is made the first
 * time a place in it is read, with the changes laid over it.
 */
export function landOf(seed: number) {
  return {
    chunks: MutableHashMap.empty<number, Chunk>(),
    clears: MutableHashMap.empty<number, Uint8Array>(),
    lifts: MutableHashMap.empty<number, Int8Array>(),
    paints: MutableHashMap.empty<number, Uint8Array>(),
    seed,
    things: MutableHashMap.empty<number, readonly (typeof Placed.Type)[]>(),
  };
}
export type Land = ReturnType<typeof landOf>;

/** The chunk at these chunk coordinates, made when the land has not read it yet. */
export function chunkAt(land: Land, cx: number, cz: number) {
  const key = keyOf(cx, cz);
  return Option.getOrElse(MutableHashMap.get(land.chunks, key), () => {
    const chunk = chunkOf(
      land.seed,
      cx,
      cz,
      MutableHashMap.get(land.lifts, key),
      MutableHashMap.get(land.paints, key)
    );
    MutableHashMap.set(land.chunks, key, chunk);
    return chunk;
  });
}

/** The chunk that holds the lattice point at these world coordinates. */
export function chunkOver(land: Land, i: number, j: number) {
  return chunkAt(land, Math.floor(i / CHUNK), Math.floor(j / CHUNK));
}

/** The ground's height at a lattice point. */
function heightOn(land: Land, i: number, j: number) {
  return chunkOver(land, i, j).heights[indexOf(i, j)];
}

/** The water's face at a lattice point. */
function surfaceOn(land: Land, i: number, j: number) {
  return chunkOver(land, i, j).surfaces[indexOf(i, j)];
}

/** A lattice value read anywhere between its points, blended from the four around the place. */
function blended(
  land: Land,
  x: number,
  z: number,
  read: (land: Land, i: number, j: number) => number
) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const across = x - i;
  const near =
    read(land, i, j) + (read(land, i + 1, j) - read(land, i, j)) * across;
  const far =
    read(land, i, j + 1) +
    (read(land, i + 1, j + 1) - read(land, i, j + 1)) * across;
  return near + (far - near) * (z - j);
}

/** The ground's height at a place, in blocks above the world's floor. */
export function heightAt(land: Land, x: number, z: number) {
  return blended(land, x, z, heightOn);
}

/** The height of the water's face at a place; it lies under the ground where the place is dry. */
export function surfaceAt(land: Land, x: number, z: number) {
  return blended(land, x, z, surfaceOn);
}

/** How deep the water stands at a place, in blocks; zero or less on dry ground. */
export function depthAt(land: Land, x: number, z: number) {
  return surfaceAt(land, x, z) - heightAt(land, x, z);
}

/** Where a body's feet rest at a place: on the ground, or a little under the water's face where it would swim. */
export function standAt(land: Land, x: number, z: number) {
  const height = heightAt(land, x, z);
  const surface = surfaceAt(land, x, z);
  return surface > height ? Math.max(height, surface - FLOAT) : height;
}

/** How steep the ground is at a place: its rise over one block along its steepest way. */
export function slopeAt(land: Land, x: number, z: number) {
  return (
    Math.hypot(
      heightAt(land, x + 0.6, z) - heightAt(land, x - 0.6, z),
      heightAt(land, x, z + 0.6) - heightAt(land, x, z - 0.6)
    ) / 1.2
  );
}

/** The direction the ground faces at a place, of length one. */
export function normalAt(land: Land, x: number, z: number) {
  const across = heightAt(land, x - 0.5, z) - heightAt(land, x + 0.5, z);
  const deep = heightAt(land, x, z - 0.5) - heightAt(land, x, z + 0.5);
  const length = Math.hypot(across, 1, deep);
  return [across / length, 1 / length, deep / length] as const;
}

/** Which way a river carries what floats at a place, of length one, none where no river flows. */
export function flowAt(land: Land, x: number, z: number) {
  const i = Math.round(x);
  const j = Math.round(z);
  const chunk = chunkOver(land, i, j);
  const index = indexOf(i, j) * 2;
  return [chunk.flows[index] / 127, chunk.flows[index + 1] / 127] as const;
}

/** What covers the ground at a place. */
export function coverAt(land: Land, x: number, z: number): Cover {
  const i = Math.round(x);
  const j = Math.round(z);
  const kinds = chunkOver(land, i, j).kinds;
  const index = indexOf(i, j) * 4;
  if (kinds[index] > 127) {
    return "path";
  }
  if (kinds[index + 1] > 127) {
    return "sand";
  }
  if (kinds[index + 2] > 127) {
    return "meadow";
  }
  return kinds[index + 3] > 150 ? "forest" : "grass";
}

/** The continent's elevation over the sea at a place, in blocks, below zero under the sea. */
export function elevationAt(land: Land, x: number, z: number) {
  const i = Math.round(x);
  const j = Math.round(z);
  return chunkOver(land, i, j).elevations[indexOf(i, j)];
}

/**
 * Forgets the made chunks farther than `reach` chunks from a chunk, so a
 * learner who walks for an hour keeps only the land about them. What they
 * changed is kept apart and is never forgotten.
 */
export function forgetBeyond(
  land: Land,
  cx: number,
  cz: number,
  reach: number
) {
  const far = Arr.filter(
    Arr.fromIterable(land.chunks),
    ([, chunk]) =>
      Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz)) > reach
  );
  for (const [key] of far) {
    MutableHashMap.remove(land.chunks, key);
  }
  return far.length;
}
