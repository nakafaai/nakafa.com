import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { tileSpans } from "@/components/tenant/home/layout";

/**
 * The columns a tile takes at two columns (from 600 pixels) and at three (from 960 pixels), by the place its
 * index gives it. The grid below follows its container, not the viewport.
 */
const tileSpan = cva("min-w-0", {
  variants: {
    three: {
      1: "@min-[960px]:col-span-1",
      2: "@min-[960px]:col-span-2",
      3: "@min-[960px]:col-span-3",
    },
    two: {
      1: "",
      2: "@min-[600px]:col-span-2",
    },
  },
});

/** One tile of a home: a key that names it, and the node that shows it. */
export interface BentoTile {
  readonly key: string;
  readonly node: ReactNode;
}

/**
 * The tiles of a home in one grid. Columns follow the width of the container that holds the grid: three from
 * 960 pixels, two from 600 pixels, and one below that. The hero takes two columns, and a lone last tile takes its
 * whole row (`tileSpans` decides both), so no row ends with one tile beside an empty space.
 */
export function Bento({ tiles }: { tiles: readonly BentoTile[] }) {
  return (
    <div className="@container">
      <div className="grid @min-[600px]:grid-cols-2 @min-[960px]:grid-cols-3 gap-4">
        {Arr.map(Arr.zip(tiles, tileSpans(tiles.length)), ([tile, span]) => (
          <div
            className={tileSpan({ three: span.three, two: span.two })}
            key={tile.key}
          >
            {tile.node}
          </div>
        ))}
      </div>
    </div>
  );
}
