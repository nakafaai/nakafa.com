import { Array as Arr, Schema } from "effect";
import type { Face, Rgb, Vec } from "@/lib/island/models/parts";
import { ball, rod, slab } from "@/lib/island/models/solids";

/** A plant's colors for its 3D model (ADR 0047, D25): its petals, the heart of its flowers or its fruit, its leaves and its stems. */
const Color = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
const Bloom = Schema.Struct({
  heart: Color,
  leaf: Color,
  petal: Color,
  stem: Color,
});
export type Bloom = typeof Bloom.Type;

/** A stem from the ground at (`x`, `z`) up to `top`, leaning to `lean`. */
export function stemOf(
  x: number,
  z: number,
  top: number,
  bloom: Bloom,
  lean: readonly [number, number] = [0, 0]
) {
  return rod(
    [x, 0, z],
    [x + lean[0], top, z + lean[1]],
    [0.02, 0.014],
    bloom.stem,
    4
  );
}

/** A leaf from `from` out toward `to`, `wide` across at its middle. */
export function leafOf(from: Vec, to: Vec, wide: number, color: Rgb) {
  const middle: Vec = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2 + wide * 0.3,
    (from[2] + to[2]) / 2,
  ];
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const across = Math.hypot(dx, dz);
  const side: Vec = [(-dz / across) * wide, 0, (dx / across) * wide];
  return slab(
    [
      from,
      [middle[0] + side[0], middle[1], middle[2] + side[2]],
      to,
      [middle[0] - side[0], middle[1], middle[2] - side[2]],
    ],
    0.012,
    color
  );
}

/** `count` leaves around a stem at height `y`, each `long` out and rising by `rise`. */
export function rosetteOf(
  count: number,
  y: number,
  long: number,
  rise: number,
  wide: number,
  color: Rgb,
  turn = 0
) {
  return Arr.flatMap(
    Arr.makeBy(count, (index) => index),
    (index) => {
      const angle = turn + (index * Math.PI * 2) / count;
      return leafOf(
        [0, y, 0],
        [Math.cos(angle) * long, y + rise, Math.sin(angle) * long],
        wide,
        color
      );
    }
  );
}

/** A flower head at `at`: a ring of petals around a heart, facing up, `r` across. */
export function headOf(at: Vec, r: number, bloom: Bloom): readonly Face[] {
  const [x, y, z] = at;
  return [
    ...ball(at, [r, r * 0.22, r], bloom.petal, 1, 8),
    ...ball(
      [x, y + r * 0.18, z],
      [r * 0.38, r * 0.2, r * 0.38],
      bloom.heart,
      1,
      6
    ),
  ];
}

/** A round leafy bush of radius `r` centered at height `y`, the leaves a little darker underneath. */
export function bushOf(y: number, r: number, bloom: Bloom): readonly Face[] {
  return ball(
    [0, y, 0],
    [r, r * 0.85, r],
    (spot) => (spot.up < -0.4 ? bloom.stem : bloom.leaf),
    3,
    8
  );
}

/** Points spread over the top of a bush of radius `r` at height `y`, `count` of them, for its flowers or its fruit. */
export function dotsOver(count: number, y: number, r: number): readonly Vec[] {
  return Arr.makeBy(count, (index): Vec => {
    const angle = index * 2.4;
    const ring = 0.45 + (index % 3) * 0.2;
    return [
      Math.cos(angle) * r * ring,
      y + r * (0.95 - ring * 0.45),
      Math.sin(angle) * r * ring,
    ];
  });
}
