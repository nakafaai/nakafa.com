"use client";

import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line-equation";
import { Origin } from "@repo/design-system/components/three/origin";
import { Polygon } from "@repo/design-system/components/three/polygon";
import type { ReactNode } from "react";
import { resolveVisualGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import type {
  PlaneVisual,
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectVisualPoint,
  resolveVisualProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { resolveMathView } from "@/lib/content/renderer/client/base/visual/view";

export interface MathSceneProps {
  readonly labels: Readonly<Record<string, ReactNode>>;
  readonly scene: PlaneVisual | SpaceVisual;
}
interface LabelAnchor {
  readonly anchorX: "center" | "left" | "right";
  readonly anchorY: "bottom" | "middle" | "top";
}

type MathLabelPlacement = Exclude<
  NonNullable<SpaceVisual["labels"]>[number]["placement"],
  undefined
>;

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

/** All authored dimensions compose the same interactive Nakafa primitives. */
export function MathScene({ labels, scene }: MathSceneProps) {
  const projection = resolveVisualProjection(scene);
  const geometry = resolveVisualGeometry(scene, projection);
  const view = resolveMathView(scene, projection);
  const origin = projectVisualPoint({ x: 0, y: 0, z: 0 }, projection);
  // Schema validation guarantees that each label has exactly one object owner.
  const anchors = scene.objects.flatMap((object) =>
    (scene.labels ?? []).flatMap((label) =>
      label.objectId === object.id
        ? [{ ...label, appearance: object.appearance }]
        : []
    )
  );
  return (
    <CoordinateSystem
      cameraPosition={view.position}
      cameraProjection={view.projection}
      cameraTarget={view.target}
      origin={origin}
      showOrigin={false}
    >
      {geometry.regions.map((region) => (
        <Polygon
          color={resolveMathAppearance(region.appearance)}
          key={region.id}
          vertices={region.vertices}
        />
      ))}
      {geometry.paths.map((path) => (
        <LineEquation
          color={resolveMathAppearance(path.appearance)}
          cone={resolveArrow(path.arrows, 0.25)}
          key={path.id}
          points={[...path.points]}
          showPoints={false}
          smooth={false}
        />
      ))}
      {geometry.markers.map((marker) => (
        <Origin
          color={resolveMathAppearance(marker.appearance)}
          key={marker.id}
          position={pointTuple(marker.at)}
          size={0.125}
        />
      ))}
      {anchors.map((label) => (
        <ThreeLabel
          {...resolveLabelAnchor(label.placement)}
          color={resolveMathAppearance(label.appearance)}
          fontSize="diagram"
          gap={0.15}
          key={label.key}
          position={pointTuple(projectVisualPoint(label.at, projection))}
        >
          {labels[label.key]}
        </ThreeLabel>
      ))}
    </CoordinateSystem>
  );
}
