"use client";

import { useGame } from "@/components/island/store";
import { chartOf } from "@/lib/island/land/chart";

/** The chart's side in pixels, and how far it reaches either way of the fox, in blocks. */
const CHART = { reach: 384, side: 192 } as const;

/** Where a place of the world lies on the chart, as a share of its side from 0 to 1, held inside it. */
function shareOf(place: number, centre: number) {
  return Math.min(
    0.98,
    Math.max(0.02, (place - centre + CHART.reach) / (CHART.reach * 2))
  );
}

/**
 * The map of the land about the fox (ADR 0050, W7): the chart of water, land,
 * terraces and what the learner built, north up, with the fox at its middle
 * and the way home marked. It is drawn once each time it opens.
 */
export function IslandChart({
  foxLabel,
  homeLabel,
}: {
  foxLabel: string;
  homeLabel: string;
}) {
  const land = useGame((state) => state.land);
  const place = useGame((state) => state.place);
  const home = useGame((state) => state.home);
  return (
    <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-lg">
      <canvas
        className="block size-full [image-rendering:pixelated]"
        height={CHART.side}
        ref={(canvas) => {
          const context = canvas?.getContext("2d");
          if (context === null || context === undefined) {
            return;
          }
          const image = context.createImageData(CHART.side, CHART.side);
          image.data.set(chartOf(land, place, CHART.reach, CHART.side));
          context.putImageData(image, 0, 0);
        }}
        width={CHART.side}
      />
      <span
        aria-label={homeLabel}
        className="bg-background ring-foreground absolute size-3 -translate-1/2 rounded-sm ring-2"
        role="img"
        style={{
          left: `${shareOf(home[0], place[0]) * 100}%`,
          top: `${shareOf(home[1], place[1]) * 100}%`,
        }}
      />
      <span
        aria-label={foxLabel}
        className="bg-primary ring-background absolute top-1/2 left-1/2 size-3 -translate-1/2 rounded-full ring-2"
        role="img"
      />
    </div>
  );
}
