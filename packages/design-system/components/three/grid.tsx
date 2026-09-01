"use client";

import { Line } from "@react-three/drei";
import {
  type CoordinateFrame,
  createGridGeometry,
  type GridPlaneGeometry,
} from "@repo/design-system/components/three/frame";
import { useMemo } from "react";
import type { ColorRepresentation } from "three";

interface GridPlaneProps {
  readonly cellColor: ColorRepresentation;
  readonly geometry: GridPlaneGeometry;
  readonly sectionColor: ColorRepresentation;
}

function GridSegments({
  color,
  lineWidth,
  points,
}: {
  readonly color: ColorRepresentation;
  readonly lineWidth: number;
  readonly points: GridPlaneGeometry["cells"];
}) {
  return points.length > 0 ? (
    <Line
      color={color}
      frustumCulled={false}
      lineWidth={lineWidth}
      points={points}
      segments
    />
  ) : null;
}

function GridPlane({ cellColor, geometry, sectionColor }: GridPlaneProps) {
  return geometry.visible ? (
    <group>
      <GridSegments color={cellColor} lineWidth={0.5} points={geometry.cells} />
      <GridSegments
        color={sectionColor}
        lineWidth={0.8}
        points={geometry.sections}
      />
      <GridSegments
        color={sectionColor}
        lineWidth={1}
        points={geometry.boundary}
      />
    </group>
  ) : null;
}

/** Renders finite Cartesian grid lines without shader offsets, fading, or faces. */
export function CoordinateGrid({
  cellColor,
  frame,
  sectionColor,
}: {
  readonly cellColor: ColorRepresentation;
  readonly frame: CoordinateFrame;
  readonly sectionColor: ColorRepresentation;
}) {
  const geometry = useMemo(() => createGridGeometry(frame), [frame]);

  return (
    <>
      <GridPlane
        cellColor={cellColor}
        geometry={geometry.xy}
        sectionColor={sectionColor}
      />
      <GridPlane
        cellColor={cellColor}
        geometry={geometry.xz}
        sectionColor={sectionColor}
      />
      <GridPlane
        cellColor={cellColor}
        geometry={geometry.yz}
        sectionColor={sectionColor}
      />
    </>
  );
}
