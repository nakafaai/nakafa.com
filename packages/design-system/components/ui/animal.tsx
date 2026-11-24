import { Picture } from "@repo/design-system/components/ui/picture";
import type { Mascot } from "@repo/mascot/code";
import { CANVAS, draw, stand } from "@repo/mascot/draw";
import { Array as Arr } from "effect";
import { useMemo } from "react";

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
  const animal = mascot?.animal;
  const eyes = mascot?.eyes;
  const ground = mascot?.ground;
  const palette = mascot?.palette;
  const pose = mascot?.pose;
  const shapes = useMemo(
    () =>
      animal === undefined ||
      eyes === undefined ||
      ground === undefined ||
      palette === undefined ||
      pose === undefined
        ? undefined
        : Arr.of(draw({ animal, eyes, ground, palette, pose })),
    [animal, eyes, ground, palette, pose]
  );

  if (shapes === undefined) {
    return null;
  }
  return (
    <Picture
      box={BOX}
      className="size-full"
      data-look=""
      marked={marked}
      shapes={shapes}
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
  const { animal, eyes, ground, palette, pose } = mascot;
  const shapes = useMemo(
    () => Arr.of(stand({ animal, eyes, ground, palette, pose })),
    [animal, eyes, ground, palette, pose]
  );

  return (
    <Picture
      box={BOX}
      className={className}
      data-look=""
      marked={marked}
      shapes={shapes}
    />
  );
}
