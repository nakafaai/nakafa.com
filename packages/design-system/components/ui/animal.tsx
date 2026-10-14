import { Picture } from "@repo/design-system/components/ui/picture";
import type { Mascot } from "@repo/mascot/code";
import { CANVAS, draw } from "@repo/mascot/draw";
import { Array as Arr } from "effect";

interface Props {
  /**
   * The animal of the person. An account read before the backfill has run holds
   * none yet, and then nothing is drawn.
   */
  mascot: typeof Mascot.Type | undefined;
}

/** The whole canvas that an animal is drawn on. */
const BOX = [0, 0, CANVAS, CANVAS] as const;

/**
 * What an animal marks in its picture: its open eyes. They carry `look`, the
 * utility that turns the eyes of a face toward the pointer wherever a page
 * watches its faces, and a face says it is one with `data-look`.
 */
function marked() {
  return { className: "look" };
}

/**
 * The profile animal of one person, drawn to fill its parent. The `Avatar` around
 * it is the circle, so the animal has no border and no rounding of its own.
 */
export function Animal({ mascot }: Props) {
  if (mascot === undefined) {
    return null;
  }
  return (
    <Picture
      box={BOX}
      className="size-full"
      data-look=""
      marked={marked}
      shapes={Arr.of(draw(mascot))}
    />
  );
}
