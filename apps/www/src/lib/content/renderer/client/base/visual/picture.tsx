import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { getColor } from "@repo/design-system/lib/color";
import { AXIS_COLORS, STROKE_DASH } from "@repo/design-system/lib/plot";
import { cva } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useFormatter } from "use-intl";
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
 * The still of a mathematical scene, which stands in its card until the reader's intent loads the scene: the same
 * unbounded world (`drawStill`), drawn flat from the scene's own camera, with the axes through the true origin in their
 * colors, every object and formula at the sliders' values, and the labels with the markup the server drew. Lines,
 * rays, regions and the axes run past the drawing to the card's edges (the SVG does not clip them; the frame does). A
 * plane scene seen head on also shows the grid, as CSS lines at the scene's steps, and the axis numbers at its major
 * lines, which stick to the card's edge when their axis is out of view. It is the truthful picture of the card, never
 * a blank frame or a skeleton, and the server draws it into the page's HTML. A label or a number stands where the
 * SVG's fit puts its point: the frame is a size container, so its offset scales with the same `min` of width and
 * height that `meet` uses.
 */
export function MathPicture({ labels = EMPTY_LABELS, scene }: MathSceneProps) {
  const projection = useMemo(() => resolveVisualProjection(scene), [scene]);
  const scope = useParameterValues();
  const format = useFormatter();
  const still = drawStill(scene, projection, scope);
  const { view } = still;
  const middle = {
    x: view.left + view.width / 2,
    y: view.top + view.height / 2,
  };
  const scale = `min(100cqw / ${view.width}, 100cqh / ${view.height})`;
  const dot = Math.max(view.width, view.height) * 0.012;
  /** Where a point of the drawing lands across the card, as CSS lengths. */
  const across = (x: number) => `calc(50cqw + ${x - middle.x} * ${scale})`;
  const down = (y: number) => `calc(50cqh - ${y - middle.y} * ${scale})`;
  // A stroke that keeps its width on screen also dashes on screen, so the dash in scene units scales like a label.
  const dash = {
    strokeDasharray: `calc(${STROKE_DASH.dash} * ${scale}) calc(${STROKE_DASH.gap} * ${scale})`,
  };

  return (
    <div
      aria-hidden="true"
      className={threeSceneFrameVariants()}
      data-slot="scene-still"
      style={{ containerType: "size" }}
    >
      {Option.match(still.grid, {
        onNone: () => null,
        onSome: (grid) => {
          const lines = (color: string) => [
            `linear-gradient(to right, var(${color}) 1px, transparent 1px)`,
            `linear-gradient(to bottom, var(${color}) 1px, transparent 1px)`,
          ];
          const x = across(grid.origin[0]);
          const y = down(grid.origin[1]);
          return (
            <div
              className="absolute inset-0 [--grid-major:var(--grid-major-light)] [--grid-minor:var(--grid-minor-light)] dark:[--grid-major:var(--grid-major-dark)] dark:[--grid-minor:var(--grid-minor-dark)]"
              data-slot="scene-grid"
              style={{
                // The scene's grid colors (`CoordinateSystem`), for each theme.
                "--grid-major-dark": getColor("NEUTRAL", 700),
                "--grid-major-light": getColor("NEUTRAL", 300),
                "--grid-minor-dark": getColor("NEUTRAL", 800),
                "--grid-minor-light": getColor("NEUTRAL", 200),
                backgroundImage: Arr.join(
                  [...lines("--grid-major"), ...lines("--grid-minor")],
                  ", "
                ),
                backgroundPosition: `${x} 0, 0 ${y}, ${x} 0, 0 ${y}`,
                backgroundSize: Arr.join(
                  [
                    `calc(${grid.major[0]} * ${scale}) 100%`,
                    `100% calc(${grid.major[1]} * ${scale})`,
                    `calc(${grid.minor[0]} * ${scale}) 100%`,
                    `100% calc(${grid.minor[1]} * ${scale})`,
                  ],
                  ", "
                ),
              }}
            />
          );
        },
      })}
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        overflow="visible"
        preserveAspectRatio="xMidYMid meet"
        viewBox={`${view.left} ${-(view.top + view.height)} ${view.width} ${view.height}`}
      >
        {Arr.map(still.axes, ({ axis, points }) => (
          <polyline
            fill="none"
            key={axis}
            points={Arr.join(Arr.map(points, svgPoint), " ")}
            stroke={AXIS_COLORS[axis]}
            strokeWidth={2}
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
              style={stroke.dashed ? dash : undefined}
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
      {Arr.map(still.ticks, (tick) => {
        const text = format.number(tick.value, "axis", {
          maximumFractionDigits: tick.digits,
        });
        // A number keeps to the card when its axis is out of view, as the scene's numbers stick to the canvas's edge.
        return (
          <span
            className="absolute text-xs leading-none whitespace-nowrap tabular-nums"
            data-axis-tick={tick.axis}
            key={tick.key}
            style={
              tick.axis === "x"
                ? {
                    color: AXIS_COLORS.x,
                    left: across(tick.at[0]),
                    top: `clamp(0.25rem, calc(${down(tick.at[1])} + 0.25rem), calc(100% - 1rem))`,
                    transform: "translateX(-50%)",
                  }
                : {
                    color: AXIS_COLORS.y,
                    left: `clamp(calc(0.25rem + ${text.length}ch), calc(${across(tick.at[0])} - 0.25rem), calc(100% - 0.25rem))`,
                    top: down(tick.at[1]),
                    transform: "translate(-100%, -50%)",
                  }
            }
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}
