import { useIntersection } from "@mantine/hooks";
import type { MarkAttributes } from "@repo/design-system/components/ui/drawing";
import { Picture } from "@repo/design-system/components/ui/picture";
import type { Mark } from "@repo/mascot/thing/mark";
import type { ThingName } from "@repo/mascot/thing/name";
import { PICTURES } from "@repo/mascot/thing/picture";
import { cva } from "class-variance-authority";
import { cn } from "cn";

/** The square that every thing is drawn on. */
const BOX = [0, 0, 64, 64] as const;

/**
 * What a shape does by itself. A motion plays only for people who have not
 * asked for less: without it a line is whole, and everything else stands still.
 */
const motionVariants = cva("", {
  variants: {
    motion: {
      dot: "motion-safe:animate-thing-dot",
      draw: "[stroke-dasharray:1] motion-safe:animate-thing-draw motion-safe:[stroke-dashoffset:1]",
      glide: "motion-safe:animate-thing-glide",
      glint: "motion-safe:animate-thing-glint",
      hop: "motion-safe:animate-thing-hop",
      open: "motion-safe:animate-thing-open",
      sway: "transform-fill origin-top motion-safe:animate-thing-sway",
      tick: "transform-view origin-[32px_36px] motion-safe:animate-thing-tick",
      wave: "transform-fill origin-left motion-safe:animate-thing-wave",
      write: "motion-safe:animate-thing-write",
    },
  },
});

/**
 * The class of a marked shape, the delay its motion starts after, and whether
 * the motion runs. A paused motion keeps its place until the thing is on screen.
 */
function markedAttributes({ delay, motion }: Mark, playing: boolean) {
  return {
    className: motionVariants({ motion }),
    style: {
      animationDelay: `${delay ?? 0}s`,
      animationPlayState: playing ? "running" : "paused",
    },
  } satisfies MarkAttributes;
}

/**
 * One thing of Nina's world as a flat picture, with no outline. Left without a
 * `size` it takes the side of the toy it lies in (`--toy`, 56px by default), and
 * its free lines take the color of the text around it, so it shows on every
 * ground. The picture itself carries no meaning for a screen reader. Its motion
 * runs only while the thing is on screen, and never for a reader who asked for
 * less motion.
 */
export function Thing({
  className,
  name,
  size,
}: {
  className?: string;
  name: ThingName;
  size?: number;
}) {
  const { entry, ref } = useIntersection({ threshold: 0 });
  const playing = entry?.isIntersecting ?? false;

  return (
    <Picture
      box={BOX}
      className={cn(
        "overflow-visible text-foreground",
        size === undefined && "size-[var(--toy,56px)]",
        className
      )}
      marked={(mark) => markedAttributes(mark, playing)}
      ref={ref}
      shapes={PICTURES[name]}
      size={size}
    />
  );
}
