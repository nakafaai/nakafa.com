import type { Placement } from "@repo/design-system/components/three/repeat";
import { Array as Arr } from "effect";

/**
 * The graduations of a precision instrument, as geometry. Every mark is one
 * thin ink-filled groove placed where its number says, so a reading can be
 * read off the drawn scale: a main scale against its vernier, a sleeve
 * against its thimble. Instruments are modelled in
 * millimetres and drawn at `MILLIMETRE` scene units each.
 */

/** Scene units in one millimetre. */
export const MILLIMETRE = 0.01;

/** How far the ink of a mark stands off the metal, in millimetres: enough to never fight the surface under it. */
const INK = 0.03;

/** Which marks of a scale are long and which are middle: every `major`th and every `minor`th. */
type Every = readonly [major: number, minor: number];

/** The lengths of a scale's long, middle and short marks, in millimetres. */
type Lengths = readonly [long: number, middle: number, short: number];

/**
 * The length of the mark at `index` on a scale whose every `major`th mark is
 * long and every `minor`th one middle.
 */
export function markLength(index: number, every: Every, lengths: Lengths) {
  if (index % every[0] === 0) {
    return lengths[0];
  }
  return index % every[1] === 0 ? lengths[1] : lengths[2];
}

/**
 * The marks of a straight scale on a face that looks along +z: mark `index`
 * stands at `start + index * step` and grows from `edge` up (`direction` 1)
 * or down (-1).
 */
export function straightMarks(scale: {
  readonly count: number;
  readonly direction: -1 | 1;
  readonly edge: number;
  readonly every: Every;
  readonly face: number;
  readonly lengths: Lengths;
  readonly start: number;
  readonly step: number;
  readonly width: number;
}): readonly Placement[] {
  return Arr.makeBy(scale.count, (index) => {
    const length = markLength(index, scale.every, scale.lengths);
    return {
      position: [
        scale.start + index * scale.step,
        scale.edge + (scale.direction * length) / 2,
        scale.face + INK / 2,
      ],
      scale: [scale.width, length, INK],
    };
  });
}

/** Where a point `radius` from the x axis stands, `angle` radians from +y toward +z. */
function around(x: number, radius: number, angle: number) {
  return [x, radius * Math.cos(angle), radius * Math.sin(angle)] as const;
}

/**
 * The marks of a barrel whose axis is x and whose datum line runs along its
 * +z side: mark `index` stands at `start + index * step` along the axis and
 * runs around the barrel from the datum line toward +y (`side` 1) or -y (-1).
 */
export function barrelMarks(barrel: {
  readonly count: number;
  readonly every: Every;
  readonly lengths: Lengths;
  readonly radius: number;
  readonly side: -1 | 1;
  readonly start: number;
  readonly step: number;
  readonly width: number;
}): readonly Placement[] {
  return Arr.makeBy(barrel.count, (index) => {
    const length = markLength(index, barrel.every, barrel.lengths);
    const angle = Math.PI / 2 - (barrel.side * length) / 2 / barrel.radius;
    return {
      position: around(
        barrel.start + index * barrel.step,
        barrel.radius + INK / 2,
        angle
      ),
      rotation: [angle - Math.PI / 2, 0, 0],
      scale: [barrel.width, length, INK],
    };
  });
}

/**
 * The angle of division `index` of a rim with `count` divisions around the x
 * axis, from +y toward +z: division 0 stands on the datum line at +z, and the
 * numbers rise toward +y.
 */
export function rimAngle(index: number, count: number) {
  return Math.PI / 2 - (index / count) * 2 * Math.PI;
}

/**
 * The marks of a bevelled rim around the x axis: a cone that starts at
 * `radius` where x is 0 and widens at `slope` radians. Mark `index` starts at
 * the edge and runs up the bevel.
 */
export function rimMarks(rim: {
  readonly count: number;
  readonly every: Every;
  readonly lengths: Lengths;
  readonly radius: number;
  readonly slope: number;
  readonly width: number;
}): readonly Placement[] {
  return Arr.makeBy(rim.count, (index) => {
    const length = markLength(index, rim.every, rim.lengths);
    const angle = rimAngle(index, rim.count);
    return {
      position: around(
        (length / 2) * Math.cos(rim.slope),
        rim.radius + (length / 2) * Math.sin(rim.slope) + INK / 2,
        angle
      ),
      rotation: [angle - Math.PI / 2, -rim.slope, 0],
      scale: [length, rim.width, INK],
    };
  });
}

/**
 * The value a moving part shows one frame later as it eases toward `target`
 * at `rate` per second: a slide that glides, a needle that settles. A scene
 * that stands still jumps there at once.
 */
export function eased(
  value: number,
  target: number,
  rate: number,
  elapsed: number
) {
  const next = value + (target - value) * Math.min(elapsed * rate, 1);
  return Math.abs(target - next) < 1e-4 ? target : next;
}
