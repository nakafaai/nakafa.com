import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { Schema } from "effect";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

/**
 * Where one of many small things stands: its place, how it leans (as turns
 * about x, y and z in radians) and its size along each axis.
 */
const TripleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
const SprigSchema = Schema.Struct({
  lean: TripleSchema,
  place: TripleSchema,
  size: TripleSchema,
});
type Sprig = typeof SprigSchema.Type;

/**
 * The placements of many copies of one small thing, sixteen numbers each,
 * ready for one instanced draw call: blades of seagrass, tentacles, hairs,
 * teeth, villi, alveoli. `sprig` places copy `index`, and reads `chance`
 * for numbers from 0 to 1 that stay the same on every visit.
 */
export function scatter(
  count: number,
  seed: number,
  sprig: (index: number, chance: (salt: number) => number) => Sprig
) {
  const placements = new Float32Array(count * 16);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const lean = new Euler();
  const place = new Vector3();
  const size = new Vector3();
  for (let index = 0; index < count; index += 1) {
    const one = sprig(index, (salt) => chanceAt(index, salt, seed));
    matrix.compose(
      place.set(...one.place),
      turn.setFromEuler(lean.set(...one.lean)),
      size.set(...one.size)
    );
    matrix.toArray(placements, index * 16);
  }
  return placements;
}
