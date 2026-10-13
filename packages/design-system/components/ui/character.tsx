import { Picture } from "@repo/design-system/components/ui/picture";
import type { Mascot } from "@repo/mascot/code";
import { CANVAS, draw } from "@repo/mascot/draw";
import { forSeed } from "@repo/mascot/seed";
import { cn } from "cn";
import { Array as Arr } from "effect";

interface Props {
  className?: string;
  name: string;
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
 * One animal of the identity, drawn from its mascot on its whole canvas. The
 * profile animals and the animal pool draw every animal through it.
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
      className={className}
      data-look=""
      marked={marked}
      shapes={Arr.of(draw(mascot))}
    />
  );
}

/**
 * The profile animal of one person, in a round frame. The animal follows the
 * seed in `name`, so the same name always shows the same animal.
 */
export function Character({ name, className }: Props) {
  return (
    <Animal
      className={cn("shrink-0 rounded-full border", className)}
      mascot={forSeed(name)}
    />
  );
}
