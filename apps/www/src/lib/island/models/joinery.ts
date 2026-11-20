import { block, row, toned } from "@/lib/island/models/forms";
import { HUES } from "@/lib/island/models/hues";
import type { Face, Rgb, Vec } from "@/lib/island/models/parts";

/**
 * A plank door on a wall that faces the front (+z), standing on `foot` at the
 * wall's face: its frame, two boards a tone apart and a brass knob, each a
 * part of its own so the edge pass draws the door against its wall (ADR
 * 0047, D44). A door is 2 m high (D10).
 */
export function doorOf(foot: Vec, wide: number): readonly Face[] {
  const [x, y, z] = foot;
  const high = 2;
  return [
    ...block([x, y, z - 0.02], [wide + 0.26, high + 0.13, 0.1], HUES.wood),
    ...row(2, (index) =>
      block(
        [x + ((index - 0.5) * wide) / 2, y, z + 0.035],
        [wide / 2, high, 0.09],
        index === 0 ? HUES.walnut : toned(HUES.walnut, 1.14)
      )
    ),
    ...block(
      [x + wide * 0.3, y + high * 0.48, z + 0.09],
      [0.07, 0.07, 0.05],
      HUES.yellow
    ),
  ];
}

/**
 * A window on a wall that faces the front (+z), its glass centered on `at` at
 * the wall's face, `size` across and up: glass over a sill, and either a
 * lintel with a shutter of the color `shutter` open at each side, or a plain
 * frame round the glass when it has none.
 */
export function windowOf(
  at: Vec,
  size: readonly [number, number],
  shutter?: Rgb
): readonly Face[] {
  const [x, y, z] = at;
  const [wide, high] = size;
  const low = y - high / 2;
  const glass = block([x, low, z], [wide, high, 0.1], HUES.glass);
  const sill = block(
    [x, low - 0.08, z + 0.03],
    [wide + 0.2, 0.08, 0.16],
    HUES.walnut
  );
  if (shutter === undefined) {
    return [
      ...block(
        [x, low - 0.07, z - 0.02],
        [wide + 0.14, high + 0.14, 0.1],
        HUES.walnut
      ),
      ...glass,
      ...sill,
    ];
  }
  return [
    ...glass,
    ...sill,
    ...block(
      [x, y + high / 2, z + 0.01],
      [wide + 0.14, 0.08, 0.12],
      HUES.walnut
    ),
    ...row(2, (index) =>
      block(
        [x + (index - 0.5) * (wide + 0.44), low, z + 0.02],
        [0.4, high, 0.06],
        index === 0 ? shutter : toned(shutter, 0.9)
      )
    ),
  ];
}
