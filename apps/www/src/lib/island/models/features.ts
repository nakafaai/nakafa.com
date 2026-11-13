import { Schema } from "effect";
import type { Traits } from "@/lib/island/fauna/families";
import type { Coat } from "@/lib/island/models/coat";
import { box, type Face, mirrored, type Vec } from "@/lib/island/models/parts";
import { ball, rod, tube } from "@/lib/island/models/solids";

/**
 * Where a head's features go (ADR 0047, D21): the top of the head between the
 * ears, its half width there, the head's size, the middle of its side where
 * the eyes sit, and the underside of the snout where tusks leave it.
 */
const Point = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
const Crown = Schema.Struct({
  eye: Point,
  jaw: Point,
  size: Schema.Finite,
  top: Point,
  wide: Schema.Finite,
});
export type Crown = typeof Crown.Type;

/** Both eyes: a small dark block on either side of the head, so a face reads from the camera's height. */
export function eyesOf(crown: Crown, coat: Coat): readonly Face[] {
  const half = crown.size * 0.075;
  const [x, y, z] = crown.eye;
  const eye = box(
    [x - half * 0.4, y - half, z - half],
    [x + half * 0.6, y + half, z + half],
    coat.eye
  );
  return [...eye, ...mirrored(eye)];
}

/** Both ears by the species' trait, a tone darker than the head: pointed, round, long, or none. */
export function earsOf(
  kind: Traits["ears"],
  crown: Crown,
  coat: Coat
): readonly Face[] {
  const [, y, z] = crown.top;
  const size = crown.size;
  const x = crown.wide * 0.6;
  const ear = (() => {
    if (kind === "point") {
      return rod(
        [x, y - size * 0.05, z],
        [x + size * 0.12, y + size * 0.45, z - size * 0.08],
        [size * 0.16, 0],
        coat.leg,
        4
      );
    }
    if (kind === "round") {
      return ball(
        [x + size * 0.05, y + size * 0.12, z - size * 0.05],
        [size * 0.17, size * 0.17, size * 0.07],
        coat.leg,
        1,
        6
      );
    }
    if (kind === "long") {
      return tube(
        [
          {
            at: [x * 0.6, y - size * 0.05, z],
            high: size * 0.07,
            wide: size * 0.13,
          },
          {
            at: [x * 0.7, y + size * 0.6, z - size * 0.08],
            high: size * 0.07,
            wide: size * 0.16,
          },
          { at: [x * 0.75, y + size * 1.1, z - size * 0.16], high: 0, wide: 0 },
        ],
        coat.leg,
        4
      );
    }
    return [];
  })();
  return [...ear, ...mirrored(ear)];
}

/** Horns, antlers or tusks by the species' trait; none draws nothing. */
export function hornsOf(
  kind: Traits["horns"],
  crown: Crown,
  coat: Coat
): readonly Face[] {
  const [, y, z] = crown.top;
  const size = crown.size;
  const x = crown.wide * 0.35;
  const horn = (() => {
    if (kind === "horns") {
      return tube(
        [
          { at: [x, y - size * 0.05, z], high: size * 0.08, wide: size * 0.08 },
          {
            at: [x + size * 0.22, y + size * 0.2, z - size * 0.05],
            high: size * 0.06,
            wide: size * 0.06,
          },
          {
            at: [x + size * 0.3, y + size * 0.45, z + size * 0.05],
            high: 0,
            wide: 0,
          },
        ],
        coat.pale,
        4
      );
    }
    if (kind === "antlers") {
      const tip = (from: Vec, to: Vec) =>
        rod(from, to, [size * 0.035, 0], coat.pale, 4);
      const fork: Vec = [x + size * 0.35, y + size * 0.7, z - size * 0.25];
      return [
        ...rod(
          [x, y - size * 0.05, z],
          fork,
          [size * 0.05, size * 0.04],
          coat.pale,
          4
        ),
        ...tip(fork, [x + size * 0.5, y + size * 1.3, z - size * 0.4]),
        ...tip(fork, [x + size * 0.75, y + size * 1.05, z - size * 0.05]),
        ...tip(
          [x + size * 0.17, y + size * 0.33, z - size * 0.12],
          [x + size * 0.3, y + size * 0.65, z + size * 0.25]
        ),
      ];
    }
    if (kind === "tusks") {
      const [, jawY, jawZ] = crown.jaw;
      return tube(
        [
          {
            at: [crown.wide * 0.4, jawY, jawZ],
            high: size * 0.07,
            wide: size * 0.07,
          },
          {
            at: [crown.wide * 0.45, jawY - size * 0.45, jawZ + size * 0.3],
            high: size * 0.05,
            wide: size * 0.05,
          },
          {
            at: [crown.wide * 0.35, jawY - size * 0.55, jawZ + size * 0.7],
            high: 0,
            wide: 0,
          },
        ],
        coat.pale,
        4
      );
    }
    return [];
  })();
  return [...horn, ...mirrored(horn)];
}

/**
 * A tail from its root on the rump, `length` long, by the species' trait: a
 * long tail drooping behind, a bushy brush with a pale tip, a short stub, or
 * none.
 */
export function tailOf(
  kind: Traits["tail"],
  root: Vec,
  length: number,
  coat: Coat
): readonly Face[] {
  const [x, y, z] = root;
  if (kind === "long") {
    return tube(
      [
        { at: root, high: length * 0.07, wide: length * 0.07 },
        {
          at: [x, y - length * 0.12, z - length * 0.35],
          high: length * 0.055,
          wide: length * 0.055,
        },
        {
          at: [x, y - length * 0.4, z - length * 0.6],
          high: length * 0.05,
          wide: length * 0.05,
        },
        { at: [x, y - length * 0.55, z - length * 0.68], high: 0, wide: 0 },
      ],
      coat.body,
      4
    );
  }
  if (kind === "bushy") {
    return ball(
      [x, y - length * 0.2, z - length * 0.45],
      [length * 0.17, length * 0.17, length * 0.5],
      (spot) => (spot.along < 0.25 ? coat.belly : coat.body),
      3,
      6
    );
  }
  if (kind === "short") {
    return ball(
      [x, y, z - length * 0.1],
      [length * 0.12, length * 0.12, length * 0.14],
      coat.body,
      1,
      6
    );
  }
  return [];
}
