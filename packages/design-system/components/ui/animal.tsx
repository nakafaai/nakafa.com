import { Picture } from "@repo/design-system/components/ui/picture";
import type { Mascot } from "@repo/mascot/code";
import { CANVAS, draw, stand } from "@repo/mascot/draw";
import { Array as Arr } from "effect";

interface Props {
  /**
   * The animal of the person. A reader that finds no account row, such as the
   * author of a comment whose row no longer exists, has none, and then nothing is
   * drawn. A deleted account keeps its animal on its tombstone.
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

/**
 * The animal of one person standing free at a width in pixels, on no ground
 * and in no circle: a character of the page, not a profile picture. Its body
 * runs to the bottom of its box, so the caller stands it behind an edge, a
 * desk or the top of a card, that cuts it. Its eyes follow the pointer like
 * every face.
 */
export function AnimalFigure({
  className,
  mascot,
}: {
  className?: string;
  mascot: typeof Mascot.Type;
}) {
  return (
    <Picture
      box={BOX}
      className={className}
      data-look=""
      marked={marked}
      shapes={Arr.of(stand(mascot))}
    />
  );
}
