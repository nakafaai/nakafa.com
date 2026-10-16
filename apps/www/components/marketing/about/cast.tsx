import { Picture } from "@repo/design-system/components/ui/picture";
import type { Box } from "@repo/design-system/lib/picture";
import type { Mascot } from "@repo/mascot/code";
import { CANVAS, draw } from "@repo/mascot/draw";
import { cn } from "cn";
import { Array as Arr } from "effect";

/** The whole canvas that an animal is drawn on. */
const BOX: Box = [0, 0, CANVAS, CANVAS];

/** What an animal marks in its picture: its open eyes, which turn toward the pointer. */
function marked() {
  return { className: "look" };
}

/**
 * One animal of the home page's cast, drawn as art: a toy beside a part of the
 * page, a friend of the crowd, or a pupil of the class. It is a picture, not a
 * person's avatar, so no Avatar wraps it, and it is drawn the way the profile
 * animal is drawn.
 */
export function CastAnimal({
  className,
  mascot,
}: {
  readonly className?: string;
  readonly mascot: typeof Mascot.Type;
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
