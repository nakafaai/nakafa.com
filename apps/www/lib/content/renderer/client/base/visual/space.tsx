"use client";

import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line-equation";
import { Origin } from "@repo/design-system/components/three/origin";
import type { ReactNode } from "react";
import { containsSpacePoint } from "@/lib/content/renderer/client/base/visual/clip";
import { resolveSpaceGeometry } from "@/lib/content/renderer/client/base/visual/geometry";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import type {
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectSpaceFrame,
  projectSpacePoint,
  resolveSpaceProjection,
} from "@/lib/content/renderer/client/base/visual/transform";
import { resolveSpaceView } from "@/lib/content/renderer/client/base/visual/view";

export interface MathSpaceProps {
  readonly labels: Readonly<Record<string, ReactNode>>;
  readonly scene: SpaceVisual;
}

interface LabelAnchor {
  readonly anchorX: "center" | "left" | "right";
  readonly anchorY: "bottom" | "middle" | "top";
}

type SpaceLabelPlacement = Exclude<
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
  } satisfies Record<SpaceLabelPlacement, LabelAnchor>;
  return anchors[placement ?? "center"];
}

function resolveArrow(position: "both" | "end" | "none", size: number) {
  return position === "none" ? undefined : { position, size };
}

/** Renders one contract-backed Cartesian space using deferred React Three Fiber. */
export function MathSpace({ labels, scene }: MathSpaceProps) {
  const projection = resolveSpaceProjection(scene);
  const frame = projectSpaceFrame(scene.frame, projection);
  const geometry = resolveSpaceGeometry(scene, projection);
  const view = resolveSpaceView(scene, projection);
  const origin = projectSpacePoint({ x: 0, y: 0, z: 0 }, projection);
  const extent = Math.max(
    frame.x.max - frame.x.min,
    frame.y.max - frame.y.min,
    frame.z.max - frame.z.min
  );
  const markerSize = Math.min(0.25, Math.max(0.08, extent / 80));

  return (
    <CoordinateSystem
      cameraMaxDistance={view.controls.maxDistance}
      cameraMinDistance={view.controls.minDistance}
      cameraPosition={view.position}
      cameraProjection={view.projection}
      cameraTarget={view.target}
      frame={frame}
      origin={origin}
      showAxes={scene.frame.axes === "visible"}
      showGrid={scene.frame.grid === "visible"}
      showLabels={scene.frame.axes === "visible"}
      showOrigin={false}
    >
      {geometry.paths.map((path) => (
        <LineEquation
          color={resolveMathAppearance(path.appearance)}
          cone={resolveArrow(path.arrows, markerSize * 2)}
          key={path.id}
          lineWidth={3}
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
          size={markerSize}
        />
      ))}
      {(scene.labels ?? []).map((label) =>
        containsSpacePoint(scene.frame, label.at) ? (
          <ThreeLabel
            {...resolveLabelAnchor(label.placement)}
            color="var(--foreground)"
            key={label.key}
            outlineColor="var(--background)"
            outlineWidth={0.04}
            position={pointTuple(projectSpacePoint(label.at, projection))}
          >
            {labels[label.key]}
          </ThreeLabel>
        ) : null
      )}
    </CoordinateSystem>
  );
}
