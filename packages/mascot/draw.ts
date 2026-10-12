import { DESIGNS } from "@repo/mascot/animal";
import type { Mascot } from "@repo/mascot/code";
import { INK } from "@repo/mascot/kit";
import { POSES } from "@repo/mascot/pose";
import { Array as Arr } from "effect";

/** The side of the square that an animal is drawn on. */
export const CANVAS = 200;

/**
 * Draws a mascot as a picture: the colour of its ground, the transform that
 * stands it in its pose on the canvas, and its shapes, back to front.
 */
export function draw(mascot: typeof Mascot.Type) {
  const design = DESIGNS[mascot.animal];
  const [body, second] = Arr.getUnsafe(design.colors, mascot.palette);
  const pose = POSES[mascot.pose];
  return {
    ground: `#${mascot.ground}`,
    shapes: design.draw({
      body,
      eyes: mascot.eyes,
      ink: INK,
      look: pose.look,
      second,
    }),
    transform: `translate(${CANVAS / 2 + pose.x} ${CANVAS + pose.y}) rotate(${pose.turn}) scale(${pose.size}) translate(${-CANVAS / 2} ${-CANVAS})`,
  };
}
