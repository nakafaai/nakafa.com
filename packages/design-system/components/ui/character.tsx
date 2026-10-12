import { Picture } from "@repo/design-system/components/ui/picture";
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
 * The profile animal of one person, in a round frame. The animal follows the
 * seed in `name`, so the same name always shows the same animal.
 */
export function Character({ name, className }: Props) {
  return (
    <Picture
      box={BOX}
      className={cn("shrink-0 rounded-full border", className)}
      data-look=""
      marked={marked}
      shapes={Arr.of(draw(forSeed(name)))}
    />
  );
}
