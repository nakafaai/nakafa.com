import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { getTileGradient } from "@repo/design-system/lib/tile";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

const tileVariants = cva(
  "group/tile flex items-center justify-center text-white",
  {
    variants: {
      variant: {
        row: "size-10 shrink-0 rounded-md ring-1 ring-black/10 ring-inset dark:ring-white/10",
        card: "w-full",
      },
    },
    defaultVariants: {
      variant: "row",
    },
  }
);

/**
 * The tile of one lesson, material, or try-out: a ground made from its seed,
 * and one white icon. `row` is the 40px rounded square that leads a list row.
 * `card` takes the full width of a catalog card, and its height comes from the
 * caller. The same seed always gives the same tile, so a seed must be a key
 * that does not change with language or edits, such as an id or a path. Tiles
 * of one list take their `seed` and `shift` from `getTileLooks`, or their
 * `shift` from `getTileShifts` when the list has no icons to tell apart; the
 * shift turns a blend away from the tiles before it. A tile on its own needs
 * none.
 */
function Tile({
  className,
  seed,
  shift,
  style,
  variant = "row",
  ...props
}: ComponentProps<"div"> &
  VariantProps<typeof tileVariants> & { seed: string; shift?: number }) {
  return (
    <div
      aria-hidden
      className={cn(tileVariants({ variant }), className)}
      data-slot="tile"
      data-variant={variant}
      style={{ ...style, backgroundImage: getTileGradient(seed, shift) }}
      {...props}
    />
  );
}

/**
 * The white icon of a tile, 16px on a `row` tile and 24px on a `card` tile.
 * The contrast test of `getTileGradient` measures the 16px icon on the 40px tile.
 */
function TileIcon({ icon }: { icon: IconSvgElement }) {
  return (
    <HugeIcons
      aria-hidden
      className="size-4 group-data-[variant=card]/tile:size-6"
      data-slot="tile-icon"
      icon={icon}
    />
  );
}

export { Tile, TileIcon };
