import { DESIGNS } from "@repo/mascot/animal";
import type { Mascot } from "@repo/mascot/code";
import { INK } from "@repo/mascot/kit";
import { POSES } from "@repo/mascot/pose";
import { CANVAS, type Picture } from "@repo/mascot/shape";
import { Array as Arr } from "effect";

/** Draws a mascot as a typed picture: its ground, its pose, and its layers. */
export function draw(mascot: typeof Mascot.Type) {
  const design = DESIGNS[mascot.animal];
  const [body, second] = Arr.getUnsafe(design.colors, mascot.palette);
  const pose = POSES[mascot.pose];
  return {
    ground: `#${mascot.ground}`,
    parts: design.draw({
      body,
      eyes: mascot.eyes,
      ink: INK,
      look: pose.look,
      second,
    }),
    transform: `translate(${CANVAS / 2 + pose.x} ${CANVAS + pose.y}) rotate(${pose.turn}) scale(${pose.size}) translate(${-CANVAS / 2} ${-CANVAS})`,
  } satisfies typeof Picture.Type;
}
