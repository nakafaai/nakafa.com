"use client";

import { CoordinateArtifactScene } from "@repo/design-system/components/learning-artifacts/coordinate-system/scene";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { cn } from "@repo/design-system/lib/utils";
import type {
  CoordinateSystemArtifact,
  CoordinateSystemPayload,
} from "@repo/math/schema/artifact/schema";
import { readScalarNumber } from "./numeric";

const DEFAULT_AXIS_SIZE = 10;
const MIN_AXIS_SIZE = 4;
const GRID_DIVISIONS = 20;

/**
 * Public design-system renderer for schema-validated coordinate artifacts.
 */
export function CoordinateArtifactRenderer({
  artifact,
  className,
}: {
  artifact: CoordinateSystemArtifact;
  className?: string;
}) {
  const axisSize = readAxisSize(artifact.payload);

  return (
    <section
      aria-label={artifact.title}
      className={cn(
        "not-prose overflow-hidden rounded-md border bg-background",
        className
      )}
    >
      <div className="border-b px-3 py-2">
        <h3 className="line-clamp-1 font-medium text-sm">{artifact.title}</h3>
        {artifact.description ? (
          <p className="line-clamp-2 text-muted-foreground text-xs">
            {artifact.description}
          </p>
        ) : null}
      </div>
      <CoordinateSystem
        className="rounded-none border-0"
        gridDivisions={GRID_DIVISIONS}
        gridSize={axisSize}
        showGizmo
        size={axisSize}
      >
        <CoordinateArtifactScene payload={artifact.payload} size={axisSize} />
      </CoordinateSystem>
    </section>
  );
}

/**
 * Computes a stable viewport size from exact axis ranges in the payload.
 */
function readAxisSize(payload: CoordinateSystemPayload) {
  const extents = [
    readAxisExtent(payload.axes.x),
    readAxisExtent(payload.axes.y),
    readAxisExtent(payload.axes.z),
  ];
  const finiteExtents = extents.filter(Number.isFinite);
  if (finiteExtents.length === 0) {
    return DEFAULT_AXIS_SIZE;
  }

  return Math.max(MIN_AXIS_SIZE, Math.ceil(Math.max(...finiteExtents)));
}

/**
 * Reads the largest absolute coordinate needed to frame one axis.
 */
function readAxisExtent(axis: CoordinateSystemPayload["axes"]["x"]) {
  const min = readScalarNumber(axis[0]);
  const max = readScalarNumber(axis[1]);

  if (min === undefined || max === undefined) {
    return DEFAULT_AXIS_SIZE;
  }

  return Math.max(Math.abs(min), Math.abs(max));
}
