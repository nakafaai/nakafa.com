import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinates";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line";
import { Origin } from "@repo/design-system/components/three/origin";
import { Polygon } from "@repo/design-system/components/three/polygon";
import { Array as Arr, Option, Result } from "effect";
import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";
import {
  labelPoint,
  resolveFormulaShapes,
} from "@/lib/content/renderer/client/base/visual/formula";
import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import { resolveVisualReach } from "@/lib/content/renderer/client/base/visual/reach";
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

function resolveArrow(position: "end" | "none", size: number) {
  return position === "none" ? undefined : { position, size };
}

/**
 * All authored dimensions compose the same interactive Nakafa primitives, in
 * an unbounded world (`resolveVisualReach`): the camera first frames the
 * scene's padded frame, while the grid, the axes through the true origin and
 * every line, ray, region and implicit curve run on past it, and the numbered
 * ticks name the grid's major lines at any zoom or pan.
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
  const world = useMemo(
    () => resolveVisualReach(scene, projection),
    [scene, projection]
  );
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
      focus={world.focus}
      origin={world.origin}
      reach={world.radius}
      scale={world.scale}
      showOrigin={false}
      ticks
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
        // A line or a ray runs to the reach: the camera fits the frame, not its length.
        <CameraBounds exclude={path.unbounded} key={path.id}>
          <LineEquation
            color={resolveMathAppearance(path.appearance)}
            cone={resolveArrow(path.arrows, 0.25)}
            dashed={path.dashed}
            points={[...path.points]}
            showPoints={false}
            smooth={false}
          />
        </CameraBounds>
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
    </CoordinateSystem>
  );
}
