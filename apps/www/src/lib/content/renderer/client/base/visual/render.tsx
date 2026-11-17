import { CoordinateSystem } from "@repo/design-system/components/three/coordinates";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { Origin } from "@repo/design-system/components/three/origin";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { AXIS_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Result } from "effect";
import { type ComponentProps, type ReactNode, useMemo } from "react";
import { useFormatter } from "use-intl";
import { resolveVisualAxes } from "@/lib/content/renderer/client/base/visual/axes";
import {
  labelPoint,
  resolveFormulaShapes,
} from "@/lib/content/renderer/client/base/visual/formula";
import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import type {
  PlaneObject,
  PlaneVisual,
  SpaceObject,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import { FormulaShapes } from "@/lib/content/renderer/client/base/visual/shapes";
import { useParameterValues } from "@/lib/content/renderer/client/base/visual/sliders";
import {
  projectVisualPoint,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { resolveMathView } from "@/lib/content/renderer/client/base/visual/view";

const EMPTY_LABELS: Readonly<Record<string, ReactNode>> = {};

export interface MathSceneProps {
  /** The rendered label of each label key; a scene whose labels have none draws no text. */
  readonly labels?: Readonly<Record<string, ReactNode>>;
  readonly scene: PlaneVisual | SpaceVisual;
}
type LabelAnchor = Pick<
  ComponentProps<typeof ThreeLabel>,
  "anchorX" | "anchorY"
>;

type MathLabelPlacement = Exclude<
  NonNullable<SpaceVisual["labels"]>[number]["placement"],
  undefined
>;

/** A label of either scene dimension, so one list can hold both. */
type VisualLabel =
  | NonNullable<PlaneVisual["labels"]>[number]
  | NonNullable<SpaceVisual["labels"]>[number];

function pointTuple({ x, y, z }: SpacePoint): [number, number, number] {
  return [x, y, z];
}

function resolveLabelAnchor(
  placement: NonNullable<SpaceVisual["labels"]>[number]["placement"]
) {
  const anchors = {
    above: { anchorX: "center", anchorY: "bottom" },
    "above-left": { anchorX: "right", anchorY: "bottom" },
    "above-right": { anchorX: "left", anchorY: "bottom" },
    below: { anchorX: "center", anchorY: "top" },
    "below-left": { anchorX: "right", anchorY: "top" },
    "below-right": { anchorX: "left", anchorY: "top" },
    center: { anchorX: "center", anchorY: "middle" },
    left: { anchorX: "right", anchorY: "middle" },
    right: { anchorX: "left", anchorY: "middle" },
  } satisfies Record<MathLabelPlacement, LabelAnchor>;
  return anchors[placement ?? "center"];
}

function resolveArrow(position: "both" | "end" | "none", size: number) {
  return position === "none" ? undefined : { position, size };
}

/**
 * All authored dimensions compose the same interactive Nakafa primitives. The
 * coordinate system takes the scene's own frame, so its axes, its grid and the
 * camera's fit cover the frame and never reach for a zero outside it, with the
 * axes and their real values where the still draws them (`resolveVisualAxes`).
 */
export function MathScene({ labels = EMPTY_LABELS, scene }: MathSceneProps) {
  const projection = useMemo(() => resolveVisualProjection(scene), [scene]);
  const geometry = resolveVisualGeometry(scene, projection);
  const scope = useParameterValues();
  const formulas = useMemo(
    () => resolveFormulaShapes(scene, projection, scope),
    [scene, projection, scope]
  );
  const view = resolveMathView(scene, projection);
  const axes = useMemo(
    () => resolveVisualAxes(scene, projection),
    [scene, projection]
  );
  const format = useFormatter();
  // Schema validation guarantees that each label has exactly one object owner.
  const objects: readonly (PlaneObject | SpaceObject)[] = scene.objects;
  const sceneLabels: readonly VisualLabel[] = scene.labels ?? [];
  const anchors = Arr.flatMap(objects, (object) =>
    Arr.flatMap(sceneLabels, (label) =>
      label.objectId === object.id
        ? Option.toArray(
            Option.map(labelPoint(label.at, scope), (at) => ({
              ...label,
              appearance: object.appearance,
              position: projectVisualPoint(at, projection),
            }))
          )
        : []
    )
  );
  return (
    <CoordinateSystem
      cameraFraming={scene.view.kind === "camera" ? undefined : "content"}
      cameraPosition={view.position}
      cameraProjection={view.projection}
      cameraTarget={view.target}
      frame={axes.frame}
      origin={axes.anchor}
      showOrigin={false}
    >
      {Result.match(formulas, {
        onFailure: (failure) => (
          <ThreeLabel
            anchorX="center"
            anchorY="middle"
            color={resolveMathAppearance("warning")}
            fontSize="diagram"
            position={view.target}
          >
            {failure.message}
          </ThreeLabel>
        ),
        onSuccess: (shapes) => <FormulaShapes shapes={shapes} />,
      })}
      {Arr.map(geometry.regions, (region) => (
        <Polygon
          color={resolveMathAppearance(region.appearance)}
          key={region.id}
          vertices={region.vertices}
        />
      ))}
      {Arr.map(geometry.paths, (path) => (
        <LineEquation
          color={resolveMathAppearance(path.appearance)}
          cone={resolveArrow(path.arrows, 0.25)}
          key={path.id}
          points={[...path.points]}
          showPoints={false}
          smooth={false}
        />
      ))}
      {Arr.map(geometry.markers, (marker) => (
        <Origin
          color={resolveMathAppearance(marker.appearance)}
          key={marker.id}
          position={pointTuple(marker.at)}
          size={0.125}
        />
      ))}
      {Arr.map(anchors, (label) => (
        <ThreeLabel
          {...resolveLabelAnchor(label.placement)}
          color={resolveMathAppearance(label.appearance)}
          fontSize="diagram"
          gap={0.15}
          key={label.key}
          position={pointTuple(label.position)}
        >
          {labels[label.key]}
        </ThreeLabel>
      ))}
      {Arr.map(axes.values, (tick) => (
        <ThreeLabel
          anchorX={tick.axis === "x" ? "center" : "right"}
          anchorY={tick.axis === "x" ? "top" : "middle"}
          color={AXIS_COLORS[tick.axis]}
          fontSize="diagram"
          gap={0.15}
          key={`${tick.axis}:${tick.end}`}
          position={pointTuple(tick.at)}
        >
          {format.number(tick.value, "math")}
        </ThreeLabel>
      ))}
    </CoordinateSystem>
  );
}
