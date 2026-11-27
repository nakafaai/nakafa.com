import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";

/**
 * A 6 V lantern battery as IEC 60086 sizes it (4R25): four cells in a
 * square block 67 mm across and 102 mm tall in a printed paper jacket, under
 * a black moulded top that carries its two terminals. Every length is in
 * metres, from the middle of its footprint on the bench.
 */
export const LANTERN = {
  /** How thick its moulded top is. */
  cap: 0.006,
  /** How tall its body is, from the bench to the underside of its top. */
  height: 0.102,
  /** How far each terminal stands from the middle, across. */
  spread: 0.017,
  /** How tall a terminal stands above the top. */
  stud: 0.016,
  /** Its width and depth. */
  width: 0.067,
} as const;

/** The top of each of its terminals, the positive one first: where a lead's plug goes. */
export const LANTERN_POSTS = [
  [-LANTERN.spread, LANTERN.height + LANTERN.cap + LANTERN.stud, 0],
  [LANTERN.spread, LANTERN.height + LANTERN.cap + LANTERN.stud, 0],
] as const;

/**
 * The jacket printed on the front of a lantern battery: its voltage large,
 * what it is, and its IEC size.
 *
 * @param volts - Its voltage
 * @param inks - The jacket's ground and its ink
 * @param format - How a number is written, in the reader's locale
 */
export function jacketOf(
  volts: number,
  inks: { readonly ground: string; readonly ink: string },
  format: (value: number, digits: number) => string
): Sheet {
  const width = LANTERN.width * 0.94;
  const height = LANTERN.height * 0.9;
  return {
    ground: inks.ground,
    height,
    marks: [
      {
        at: [0, height * 0.32],
        height: height * 0.08,
        ink: inks.ink,
        kind: "band",
        radius: 0,
        width,
      },
      words({
        at: [0, height * 0.08],
        ink: inks.ink,
        size: 0.017,
        text: `${format(volts, 0)} V`,
        weight: 700,
      }),
      words({
        at: [0, -height * 0.14],
        ink: inks.ink,
        size: 0.0052,
        text: "LANTERN BATTERY",
        weight: 600,
      }),
      words({
        at: [0, -height * 0.3],
        ink: inks.ink,
        size: 0.0046,
        text: "4R25",
      }),
    ],
    width,
  };
}
