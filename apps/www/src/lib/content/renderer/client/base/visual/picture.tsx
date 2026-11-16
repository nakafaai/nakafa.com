import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { cva } from "class-variance-authority";
import { Array as Arr } from "effect";
import { type ReactNode, useMemo } from "react";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import type { MathSceneProps } from "@/lib/content/renderer/client/base/visual/render";
import { useParameterValues } from "@/lib/content/renderer/client/base/visual/sliders";
import { drawStill } from "@/lib/content/renderer/client/base/visual/still";
import { resolveVisualProjection } from "@/lib/content/renderer/client/base/visual/transform";

const EMPTY_LABELS: Readonly<Record<string, ReactNode>> = {};

/** Where a label stands from its point, as the scene places it. */
const labelVariants = cva("absolute text-sm leading-none whitespace-nowrap", {
  variants: {
    placement: {
      above: "-translate-x-1/2 -translate-y-[calc(100%+0.25rem)]",
      "above-left":
        "-translate-x-[calc(100%+0.25rem)] -translate-y-[calc(100%+0.25rem)]",
      "above-right": "translate-x-1 -translate-y-[calc(100%+0.25rem)]",
      below: "-translate-x-1/2 translate-y-1",
      "below-left": "-translate-x-[calc(100%+0.25rem)] translate-y-1",
      "below-right": "translate-x-1 translate-y-1",
      center: "-translate-x-1/2 -translate-y-1/2",
      left: "-translate-x-[calc(100%+0.25rem)] -translate-y-1/2",
      right: "translate-x-1 -translate-y-1/2",
    },
  },
});

/** One point of the still in the SVG's coordinates, whose y runs down. */
function svgPoint([x, y]: readonly [number, number]) {
  return `${x},${-y}`;
}

/**
 * The still of a mathematical scene, which stands in its card until the reader's intent loads the scene: the axes,
 * every object and formula at the sliders' values, and the labels with the markup the server drew, drawn flat from the
 * scene's own camera (`drawStill`). It is the truthful picture of the card, never a blank frame or a skeleton, and the
 * server draws it into the page's HTML. A label stands where the SVG's fit puts its point: the frame is a size
 * container, so the label's offset scales with the same `min` of width and height that `meet` uses.
 */
export function MathPicture({ labels = EMPTY_LABELS, scene }: MathSceneProps) {
  const projection = useMemo(() => resolveVisualProjection(scene), [scene]);
  const scope = useParameterValues();
  const still = drawStill(scene, projection, scope);
  const { view } = still;
  const middle = {
    x: view.left + view.width / 2,
    y: view.top + view.height / 2,
  };
  const scale = `min(100cqw / ${view.width}, 100cqh / ${view.height})`;
  const dot = Math.max(view.width, view.height) * 0.012;

  return (
    <div
      aria-hidden="true"
      className={threeSceneFrameVariants()}
      style={{ containerType: "size" }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`${view.left} ${-(view.top + view.height)} ${view.width} ${view.height}`}
      >
        {Arr.map(still.axes, ({ axis, points }) => (
          <polyline
            className="stroke-muted-foreground/40"
            fill="none"
            key={axis}
            points={Arr.join(Arr.map(points, svgPoint), " ")}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {Arr.map(still.areas, (area) => (
          <path
            d={Arr.join(
              Arr.map(
                area.rings,
                (ring) => `M${Arr.join(Arr.map(ring, svgPoint), "L")}Z`
              ),
              ""
            )}
            fill={resolveMathAppearance(area.appearance)}
            fillOpacity={0.2}
            key={area.id}
          />
        ))}
        {Arr.map(still.strokes, (stroke) =>
          stroke.closed ? (
            <polygon
              fill={
                stroke.filled
                  ? resolveMathAppearance(stroke.appearance)
                  : "none"
              }
              fillOpacity={0.2}
              key={stroke.id}
              points={Arr.join(Arr.map(stroke.points, svgPoint), " ")}
              stroke={resolveMathAppearance(stroke.appearance)}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ) : (
            <polyline
              fill="none"
              key={stroke.id}
              points={Arr.join(Arr.map(stroke.points, svgPoint), " ")}
              stroke={resolveMathAppearance(stroke.appearance)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )
        )}
        {Arr.map(still.dots, (point) => (
          <circle
            cx={point.at[0]}
            cy={-point.at[1]}
            fill={resolveMathAppearance(point.appearance)}
            key={point.id}
            r={dot}
          />
        ))}
      </svg>
      {Arr.map(still.labels, (label) => (
        <span
          className={labelVariants({ placement: label.placement })}
          key={label.key}
          style={{
            color: resolveMathAppearance(label.appearance),
            left: `calc(50% + ${label.at[0] - middle.x} * ${scale})`,
            top: `calc(50% - ${label.at[1] - middle.y} * ${scale})`,
          }}
        >
          {labels[label.key]}
        </span>
      ))}
    </div>
  );
}
