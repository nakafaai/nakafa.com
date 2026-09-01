import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { type CSSProperties, type ReactNode, useId } from "react";
import { createPlaneArc } from "@/lib/content/renderer/client/base/visual/arc";
import { containsPlanePoint } from "@/lib/content/renderer/client/base/visual/clip";
import {
  type ResolvedPlaneObject,
  resolvePlaneGeometry,
} from "@/lib/content/renderer/client/base/visual/geometry";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import { PlanePath } from "@/lib/content/renderer/client/base/visual/path";
import {
  createPlanePoints,
  createPlaneQuadratic,
  createPlaneTicks,
  PLANE_HEIGHT,
  PLANE_WIDTH,
  type PlaneViewport,
  projectPlanePoint,
  projectPlaneRadius,
  resolvePlaneViewport,
} from "@/lib/content/renderer/client/base/visual/projection";
import type { PlaneVisual } from "@/lib/content/renderer/client/base/visual/scene";

const POINT_RADIUS = 5;

interface Props {
  readonly labels: Readonly<Record<string, ReactNode>>;
  readonly scene: PlaneVisual;
}

type PlaneLabelPlacement = Exclude<
  NonNullable<PlaneVisual["labels"]>[number]["placement"],
  undefined
>;

function PlaneObject({
  object,
  viewport,
}: {
  readonly object: ResolvedPlaneObject;
  readonly viewport: PlaneViewport;
}) {
  const color = resolveMathAppearance(object.appearance);
  if (object.kind === "point") {
    const at = projectPlanePoint(object.at, viewport);
    return <circle cx={at.x} cy={at.y} fill={color} r={POINT_RADIUS} />;
  }
  if (object.kind === "circle") {
    const center = projectPlanePoint(object.center, viewport);
    return (
      <circle
        cx={center.x}
        cy={center.y}
        fill="none"
        r={projectPlaneRadius(object.radius, viewport)}
        stroke={color}
        strokeWidth={3}
      />
    );
  }
  if (object.kind === "arc") {
    return (
      <path
        d={createPlaneArc(object, viewport)}
        fill="none"
        stroke={color}
        strokeWidth={3}
      />
    );
  }
  if (object.kind === "quadratic") {
    return (
      <path
        d={createPlaneQuadratic(object, viewport)}
        fill="none"
        stroke={color}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeWidth={3}
      />
    );
  }
  return (
    <PlanePath
      arrows={object.arrows}
      color={color}
      fill={object.fill}
      points={createPlanePoints(object.points, viewport)}
    />
  );
}

function labelTransform(
  placement: NonNullable<PlaneVisual["labels"]>[number]["placement"]
) {
  const transforms = {
    above: "translate(-50%, calc(-100% - 6px))",
    "above-left": "translate(calc(-100% - 6px), calc(-100% - 6px))",
    "above-right": "translate(6px, calc(-100% - 6px))",
    below: "translate(-50%, 6px)",
    "below-left": "translate(calc(-100% - 6px), 6px)",
    "below-right": "translate(6px, 6px)",
    center: "translate(-50%, -50%)",
    left: "translate(calc(-100% - 6px), -50%)",
    right: "translate(6px, -50%)",
  } satisfies Record<PlaneLabelPlacement, string>;
  return transforms[placement ?? "center"];
}

/** Renders one exact Cartesian plane as deterministic SVG plus rich labels. */
export function MathPlane({ labels, scene }: Props) {
  const clipId = `math-frame-${useId().replaceAll(":", "")}`;
  const viewport = resolvePlaneViewport(scene);
  const xTicks = createPlaneTicks(scene.frame.x);
  const yTicks = createPlaneTicks(scene.frame.y);
  const frameStart = projectPlanePoint(
    { x: scene.frame.x.min, y: scene.frame.y.max },
    viewport
  );
  const frameEnd = projectPlanePoint(
    { x: scene.frame.x.max, y: scene.frame.y.min },
    viewport
  );
  const xAxisStart = projectPlanePoint(
    { x: scene.frame.x.min, y: 0 },
    viewport
  );
  const xAxisEnd = projectPlanePoint({ x: scene.frame.x.max, y: 0 }, viewport);
  const yAxisStart = projectPlanePoint(
    { x: 0, y: scene.frame.y.min },
    viewport
  );
  const yAxisEnd = projectPlanePoint({ x: 0, y: scene.frame.y.max }, viewport);

  return (
    <div aria-hidden="true" className={threeSceneFrameVariants()}>
      <div className="absolute inset-x-0 top-1/2 aspect-[3/2] -translate-y-1/2">
        <svg
          aria-hidden="true"
          className="size-full"
          viewBox={`0 0 ${PLANE_WIDTH} ${PLANE_HEIGHT}`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                height={frameEnd.y - frameStart.y}
                width={frameEnd.x - frameStart.x}
                x={frameStart.x}
                y={frameStart.y}
              />
            </clipPath>
          </defs>
          <rect
            fill="transparent"
            height={frameEnd.y - frameStart.y}
            stroke="var(--border)"
            width={frameEnd.x - frameStart.x}
            x={frameStart.x}
            y={frameStart.y}
          />
          {scene.frame.grid === "visible"
            ? xTicks.map((x) => {
                const start = projectPlanePoint(
                  { x, y: scene.frame.y.min },
                  viewport
                );
                const end = projectPlanePoint(
                  { x, y: scene.frame.y.max },
                  viewport
                );
                return (
                  <line
                    key={`grid-x-${x}`}
                    stroke="var(--border)"
                    strokeOpacity={0.65}
                    x1={start.x}
                    x2={end.x}
                    y1={start.y}
                    y2={end.y}
                  />
                );
              })
            : null}
          {scene.frame.grid === "visible"
            ? yTicks.map((y) => {
                const start = projectPlanePoint(
                  { x: scene.frame.x.min, y },
                  viewport
                );
                const end = projectPlanePoint(
                  { x: scene.frame.x.max, y },
                  viewport
                );
                return (
                  <line
                    key={`grid-y-${y}`}
                    stroke="var(--border)"
                    strokeOpacity={0.65}
                    x1={start.x}
                    x2={end.x}
                    y1={start.y}
                    y2={end.y}
                  />
                );
              })
            : null}
          {scene.frame.axes === "visible" &&
          scene.frame.y.min <= 0 &&
          scene.frame.y.max >= 0 ? (
            <line
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              x1={xAxisStart.x}
              x2={xAxisEnd.x}
              y1={xAxisStart.y}
              y2={xAxisEnd.y}
            />
          ) : null}
          {scene.frame.axes === "visible" &&
          scene.frame.x.min <= 0 &&
          scene.frame.x.max >= 0 ? (
            <line
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              x1={yAxisStart.x}
              x2={yAxisEnd.x}
              y1={yAxisStart.y}
              y2={yAxisEnd.y}
            />
          ) : null}
          <g clipPath={`url(#${clipId})`}>
            {resolvePlaneGeometry(scene).map((object) => (
              <PlaneObject
                key={object.id}
                object={object}
                viewport={viewport}
              />
            ))}
          </g>
        </svg>
        {(scene.labels ?? []).map((anchor) => {
          if (!containsPlanePoint(scene.frame, anchor.at)) {
            return null;
          }
          const position = projectPlanePoint(anchor.at, viewport);
          const style: CSSProperties = {
            left: `${(position.x / PLANE_WIDTH) * 100}%`,
            position: "absolute",
            top: `${(position.y / PLANE_HEIGHT) * 100}%`,
            transform: labelTransform(anchor.placement),
          };
          return (
            <div className="font-mono text-sm" key={anchor.key} style={style}>
              {labels[anchor.key]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
