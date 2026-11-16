import { DESIGNS } from "@repo/mascot/animal";
import type { Mascot } from "@repo/mascot/code";
import { INK } from "@repo/mascot/kit";
import { POSES } from "@repo/mascot/pose";
import { group, rect } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

/** The side of the square that an animal is drawn on. */
export const CANVAS = 200;

/** The layers of a mascot's animal in its own palette, its eyes turned `look` to the side. */
function layers(mascot: typeof Mascot.Type, look: number) {
  const design = DESIGNS[mascot.animal];
  const [body, second] = Arr.getUnsafe(design.colors, mascot.palette);
  return design.draw({ body, eyes: mascot.eyes, ink: INK, look, second });
}

/**
 * Draws a mascot as one picture on the square canvas: its ground, then the
 * animal standing in its pose, its shapes back to front.
 */
export function draw(mascot: typeof Mascot.Type) {
  const pose = POSES[mascot.pose];
  return group([
    rect({ fill: `#${mascot.ground}`, height: CANVAS, width: CANVAS }),
    group(layers(mascot, pose.look), {
      transform: `translate(${CANVAS / 2 + pose.x} ${CANVAS + pose.y}) rotate(${pose.turn}) scale(${pose.size}) translate(${-CANVAS / 2} ${-CANVAS})`,
    }),
  ]);
}

/**
 * Draws a mascot standing free: the animal alone, upright in the middle of the
 * canvas and looking ahead, on no ground and in no pose. Its body runs to the
 * bottom of the canvas, so what it stands behind, a desk or the edge of a
 * card, is the edge that cuts it.
 */
export function stand(mascot: typeof Mascot.Type) {
  return group(layers(mascot, 0));
}
