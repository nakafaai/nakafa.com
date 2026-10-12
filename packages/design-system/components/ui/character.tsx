import { Drawing } from "@repo/design-system/components/ui/drawing";
import { CANVAS, draw } from "@repo/mascot/draw";
import { forSeed } from "@repo/mascot/seed";
import { cn } from "cn";

interface Props {
  className?: string;
  name: string;
}

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
    <svg
      aria-hidden="true"
      className={cn("shrink-0 rounded-full border", className)}
      data-look=""
      viewBox={`0 0 ${CANVAS} ${CANVAS}`}
    >
      <Drawing marked={marked} shape={draw(forSeed(name))} />
    </svg>
  );
}
