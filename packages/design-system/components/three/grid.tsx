import { Grid, Line } from "@react-three/drei";
import {
  type CoordinateFrame,
  createGridGeometry,
  type GridPlaneGeometry,
} from "@repo/design-system/components/three/frame";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { type ColorRepresentation, DoubleSide } from "three";

interface GridPlaneProps {
  readonly cellColor: ColorRepresentation;
  readonly geometry: GridPlaneGeometry;
  readonly sectionColor: ColorRepresentation;
}

/** Draws a plane's cells, sections, and boundary, each only when it has segments. */
function GridPlane({ cellColor, geometry, sectionColor }: GridPlaneProps) {
  if (!geometry.visible) {
    return null;
  }
  const segments = [
    { color: cellColor, id: "cells", lineWidth: 0.5, points: geometry.cells },
    {
      color: sectionColor,
      id: "sections",
      lineWidth: 0.8,
      points: geometry.sections,
    },
    {
      color: sectionColor,
      id: "boundary",
      lineWidth: 1,
      points: geometry.boundary,
    },
  ];

  return (
    <group>
      {Arr.map(segments, ({ color, id, lineWidth, points }) =>
        points.length > 0 ? (
          <Line
            color={color}
            depthWrite={false}
            frustumCulled={false}
            key={id}
            lineWidth={lineWidth}
            opacity={0.2}
            points={points}
            segments
            transparent
          />
        ) : null
      )}
    </group>
  );
}

/** Keeps explicit mathematical frames finite and the general world continuous. */
export function CoordinateGrid({
  cellColor,
  frame,
  infinite = false,
  origin,
  sectionColor,
}: {
  readonly cellColor: ColorRepresentation;
  readonly frame: CoordinateFrame;
  readonly infinite?: boolean;
  readonly origin?: Point3 | undefined;
  readonly sectionColor: ColorRepresentation;
}) {
  const geometry = useMemo(
    () => createGridGeometry(frame, origin),
    [frame, origin]
  );

  if (infinite) {
    return (
      <group position={[origin?.x ?? 0, origin?.y ?? 0, origin?.z ?? 0]}>
        {Arr.map(
          [
            [Math.PI / 2, 0, 0],
            [0, 0, 0],
            [0, 0, Math.PI / 2],
          ],
          ([x, y, z]) => (
            <Grid
              args={[2, 2]}
              cellColor={cellColor}
              cellSize={1}
              cellThickness={0.35}
              fadeDistance={80}
              fadeStrength={2}
              followCamera
              infiniteGrid
              key={`${x}-${y}-${z}`}
              material-depthWrite={false}
              rotation={[x, y, z]}
              sectionColor={sectionColor}
              sectionSize={5}
              sectionThickness={0.6}
              side={DoubleSide}
            />
          )
        )}
      </group>
    );
  }

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
