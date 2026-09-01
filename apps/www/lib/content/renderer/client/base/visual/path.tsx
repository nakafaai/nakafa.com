import { useId } from "react";

import type { MathPathArrows } from "@/lib/content/renderer/client/base/visual/geometry";

interface Props {
  readonly arrows: MathPathArrows;
  readonly color: string;
  readonly fill: boolean;
  readonly points: string;
}

/** Renders one exact SVG path with mathematically meaningful terminals. */
export function PlanePath({ arrows, color, fill, points }: Props) {
  const markerId = `math-arrow-${useId().replaceAll(":", "")}`;
  const marker = arrows === "none" ? undefined : `url(#${markerId})`;
  return (
    <>
      {marker ? (
        <defs>
          <marker
            id={markerId}
            markerHeight={3}
            markerUnits="strokeWidth"
            markerWidth={3.6}
            orient="auto-start-reverse"
            refX={10}
            refY={5}
            viewBox="0 0 12 10"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
          </marker>
        </defs>
      ) : null}
      <polyline
        fill={fill ? color : "none"}
        fillOpacity={fill ? 0.12 : undefined}
        markerEnd={marker}
        markerStart={arrows === "both" ? marker : undefined}
        points={points}
        stroke={color}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeWidth={3}
      />
    </>
  );
}
