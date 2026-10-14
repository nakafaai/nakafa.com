import { Picture } from "@repo/design-system/components/ui/picture";
import type { Box } from "@repo/design-system/lib/picture";
import type { Mascot } from "@repo/mascot/code";
import { CANVAS, draw } from "@repo/mascot/draw";
import { cn } from "cn";
import { Array as Arr } from "effect";

/** The whole canvas that an animal is drawn on. */
const BOX: Box = [0, 0, CANVAS, CANVAS];

/**
 * What an animal marks in its picture: its open eyes. They carry `look`, the
 * utility that turns the eyes of a face toward the pointer wherever a page
 * watches its faces, and a face says it is one with `data-look`.
 */
function marked() {
  return { className: "look" };
}

/**
 * One animal of the identity, drawn from the mascot that names it. The same
 * mascot always draws the same picture, so a page can give each animal its own
 * place in a cast without a second copy of the drawing.
 */
export function Animal({
  className,
  mascot,
}: {
  className?: string;
  mascot: typeof Mascot.Type;
}) {
  return (
    <Picture
      box={BOX}
      className={cn("shrink-0", className)}
      data-look=""
      marked={marked}
      shapes={Arr.of(draw(mascot))}
    />
  );
}
