import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";

/** A point in a bacterium's own frame, its long axis along x, in micrometres. */
type Point = readonly [number, number, number];

/**
 * The outline of a rod-shaped cell, turned about its long axis: a cylinder
 * `length` long between two hemispherical poles of `radius`, as (radius, x)
 * pairs from one pole's tip to the other's, `samples` steps on each pole and
 * as many along the side.
 */
export function rodProfile(radius: number, length: number, samples: number) {
  const half = length / 2;
  const pole = (side: -1 | 1) =>
    Arr.map(Arr.range(0, samples), (step) => {
      const angle = (step / samples) * (Math.PI / 2);
      return [
        radius * Math.sin(angle),
        side * (half + radius * Math.cos(angle)),
      ] as const;
    });
  const side = Arr.map(
    Arr.range(1, samples - 1),
    (step) => [radius, half - (length * step) / samples] as const
  );
  return [...pole(1), ...side, ...Arr.reverse(pole(-1))];
}

/**
 * How far a cell's surface bulges out at angle `around` its axis and `along`
 * it, as a share of its radius: a living envelope is never a perfect solid of
 * revolution, so two octaves of smooth noise lift and sink it by a few
 * hundredths.
 */
export function surfaceBump(around: number, along: number, seed: number) {
  const u = (around / (Math.PI * 2)) * 16 + seed * 7;
  const v = along * 9 + seed * 3;
  return (
    0.07 * (valueNoise(u, v, 16) - 0.5) +
    0.025 * (valueNoise(u * 3, v * 3, 48) - 0.5)
  );
}

/**
 * A flagellar filament's centre line as a left-handed helix starting at the
 * origin and running along +x: `length` long, its helix `pitch` and `radius`
 * as in the normal form of Escherichia coli (pitch about 2.3 to 2.5 µm, helix
 * diameter about 0.4 to 0.5 µm), turned by `phase`. The helix opens from
 * nothing at the hook, as a real filament leaves its hook nearly straight.
 */
export function flagellumPath({
  length,
  phase,
  pitch,
  radius,
  samples,
}: {
  readonly length: number;
  readonly phase: number;
  readonly pitch: number;
  readonly radius: number;
  readonly samples: number;
}) {
  return Arr.map(Arr.range(0, samples), (step): Point => {
    const x = (length * step) / samples;
    const ramp = Math.min(1, x / (pitch * 0.4));
    const angle = -(x / pitch) * Math.PI * 2 + phase;
    return [
      x,
      radius * ramp * Math.cos(angle),
      radius * ramp * Math.sin(angle),
    ];
  });
}

/**
 * Where `count` appendages leave a rod's surface, spread evenly by a golden
 * spiral over the side and both poles, each with the outward normal it stands
 * along.
 */
export function rodSurfaceSpots(count: number, radius: number, length: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const span = length + 2 * radius;
  return Arr.map(Arr.range(0, count - 1), (index) => {
    const x = -span / 2 + ((index + 0.5) / count) * span;
    const angle = index * golden;
    const beyond = Math.max(0, Math.abs(x) - length / 2);
    const ring = Math.sqrt(Math.max(0, radius * radius - beyond * beyond));
    const centre = Math.sign(x) * Math.min(Math.abs(x), length / 2);
    const position: Point = [x, ring * Math.cos(angle), ring * Math.sin(angle)];
    const normal: Point = [
      (x - centre) / radius,
      position[1] / radius,
      position[2] / radius,
    ];
    return { normal, position };
  });
}

/** Whether a point lies inside a rod `length` long with poles of `radius`. */
export function insideRod(point: Point, radius: number, length: number) {
  const along = Math.max(0, Math.abs(point[0]) - length / 2);
  return (
    along * along + point[1] * point[1] + point[2] * point[2] < radius * radius
  );
}

/**
 * At most `count` points scattered through a rod's cytoplasm,
 * deterministically, for the ribosomes that crowd a bacterial cell, kept a
 * margin inside the membrane.
 */
export function cytoplasmPoints(
  count: number,
  radius: number,
  length: number,
  seed: number
) {
  const inner = radius * 0.86;
  const candidates = Arr.map(
    Arr.range(0, count * 2 - 1),
    (index): Point => [
      (hashUnit(index, seed) - 0.5) * (length + 2 * inner),
      (hashUnit(index + 101, seed) - 0.5) * 2 * inner,
      (hashUnit(index + 211, seed) - 0.5) * 2 * inner,
    ]
  );
  return Arr.take(
    Arr.filter(candidates, (point) => insideRod(point, inner, length)),
    count
  );
}

/**
 * The tangled loop of a nucleoid: a smooth wandering path of `steps` steps
 * that stays in a core about `reach` across and `length` long in the middle
 * of the cell, where the chromosome packs without a nuclear envelope.
 */
export function nucleoidPath(
  steps: number,
  reach: number,
  length: number,
  seed: number
) {
  return Arr.map(Arr.range(0, steps), (step): Point => {
    const turn = (step / steps) * Math.PI * 14;
    const wobble = (salt: number) =>
      (hashUnit(step, seed + salt) - 0.5) * reach * 0.35;
    return [
      (Math.sin(turn * 0.37 + seed) * length) / 2 + wobble(1),
      Math.cos(turn) * reach * 0.8 + wobble(2),
      Math.sin(turn * 1.3) * reach * 0.8 + wobble(3),
    ];
  });
}
