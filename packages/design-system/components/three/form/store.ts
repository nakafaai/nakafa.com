import type { Shape } from "@repo/design-system/components/three/form/sweep";
import { MutableHashMap, Option } from "effect";
import { BufferAttribute, BufferGeometry } from "three";

/** Every geometry in use, by the key of what it is, with how many parts hold it. */
const SHARED = MutableHashMap.empty<
  string,
  { readonly geometry: BufferGeometry; uses: number }
>();

/** A geometry from a built surface, with the bounds a renderer culls and fits by. */
function geometryOf(shape: Shape) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(shape.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(shape.normals, 3));
  geometry.setAttribute("uv", new BufferAttribute(shape.uvs, 2));
  geometry.setIndex(new BufferAttribute(shape.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The geometry of one shape, built the first time its key is asked for and
 * shared by every part that asks again: forty bolts, or the same beaker in
 * two labs, are one buffer on the graphics card.
 *
 * @param key - What the shape is, the same for the same shape
 * @param build - Builds its surface, called only when no part has it yet
 */
export function claim(key: string, build: () => Shape) {
  return Option.getOrElse(MutableHashMap.get(SHARED, key), () => {
    const entry = { geometry: geometryOf(build()), uses: 0 };
    MutableHashMap.set(SHARED, key, entry);
    return entry;
  }).geometry;
}

/**
 * Holds a claimed geometry for as long as a part shows it, and returns the
 * release to call when the part goes away. The geometry is freed when its
 * last holder lets go, so no part disposes of anything itself.
 *
 * @param key - The key the geometry was claimed with
 * @param geometry - The claimed geometry
 */
export function hold(key: string, geometry: BufferGeometry) {
  const entry = Option.getOrElse(MutableHashMap.get(SHARED, key), () => {
    const kept = { geometry, uses: 0 };
    MutableHashMap.set(SHARED, key, kept);
    return kept;
  });
  entry.uses += 1;
  return () => {
    entry.uses -= 1;
    if (entry.uses === 0) {
      MutableHashMap.remove(SHARED, key);
      entry.geometry.dispose();
    }
  };
}
