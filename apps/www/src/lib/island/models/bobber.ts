import type { Face } from "@/lib/island/models/parts";
import { meters, rgb } from "@/lib/island/models/parts";
import { ball, rod, scaled } from "@/lib/island/models/solids";

/** A float's red cap, its white belly and the dark quill that stands out of it. */
const PAINT = {
  belly: rgb(0xf2_ee_e2),
  cap: rgb(0xd8_45_3a),
  quill: rgb(0x3a_32_2c),
} as const;

/**
 * The float of the learner's own line (ADR 0047, D15), in blocks, about the
 * water's face: a white belly under it, a red cap over it and a quill that
 * shows where it is from the bank. It is drawn three times its real size, as
 * a float 4 cm across would be lost nine blocks from the lens.
 */
export function bobberFaces(): readonly Face[] {
  return scaled(
    [
      ...ball([0, -0.03, 0], [0.06, 0.06, 0.06], PAINT.belly, 2, 6),
      ...ball([0, 0.03, 0], [0.06, 0.05, 0.06], PAINT.cap, 2, 6),
      ...rod([0, 0.06, 0], [0, 0.2, 0], [0.012, 0.008], PAINT.quill, 4),
    ],
    meters(1)
  );
}
