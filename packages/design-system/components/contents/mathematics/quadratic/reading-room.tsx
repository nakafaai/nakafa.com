"use client";

import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  CoordinateControls,
  CoordinateProvider,
} from "@repo/design-system/components/three/controls";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { LineEquation } from "@repo/design-system/components/three/line-equation";
import { Polygon } from "@repo/design-system/components/three/polygon";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { COLORS } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface ReadingRoomProblemProps {
  heightLabel: ReactNode;
  widthLabel: ReactNode;
}

const ROOM = [
  { x: -3, y: -2, z: 0 },
  { x: 3, y: -2, z: 0 },
  { x: 3, y: 2, z: 0 },
  { x: -3, y: 2, z: 0 },
];

// The room keeps its exact 6:4 proportions. Each unknown x is illustrated by
// the same schematic square, without assigning x a value from the solution.
const CORNER_SIDE = 0.75;
const CORNERS = [
  { id: "top-left", x: -3, y: 2, dx: 1, dy: -1, color: COLORS.BLUE },
  { id: "top-right", x: 3, y: 2, dx: -1, dy: -1, color: COLORS.PURPLE },
  { id: "bottom-left", x: -3, y: -2, dx: 1, dy: 1, color: COLORS.AMBER },
  { id: "bottom-right", x: 3, y: -2, dx: -1, dy: 1, color: COLORS.GREEN },
];

/** Composes the room and its four equal square corners on the shared plane. */
export function ReadingRoomProblem({
  heightLabel,
  widthLabel,
}: ReadingRoomProblemProps) {
  return (
    <CoordinateProvider>
      <Card className="my-6">
        <CardHeader>
          <CardTitle>
            {widthLabel} × {heightLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CoordinateSystem cameraPosition={[0, 0, 15]}>
            <LineEquation
              color={COLORS.SLATE}
              points={[...ROOM, ROOM[0]]}
              showPoints={false}
              smooth={false}
            />
            <ThreeLabel
              anchorX="left"
              anchorY="top"
              color={COLORS.SLATE}
              fontSize="diagram"
              gap={0.2}
              position={[0, -2, 0]}
            >
              {widthLabel}
            </ThreeLabel>
            <ThreeLabel
              anchorX="left"
              anchorY="bottom"
              color={COLORS.SLATE}
              fontSize="diagram"
              gap={0.2}
              position={[3, 0, 0]}
            >
              {heightLabel}
            </ThreeLabel>
            {CORNERS.map(({ id, x, y, dx, dy, color }) => {
              const insideX = x + dx * CORNER_SIDE;
              const insideY = y + dy * CORNER_SIDE;
              const vertices = [
                { x, y, z: 0 },
                { x: insideX, y, z: 0 },
                { x: insideX, y: insideY, z: 0 },
                { x, y: insideY, z: 0 },
              ];
              return (
                <group key={id}>
                  <Polygon color={color} opacity={0.5} vertices={vertices} />
                  <LineEquation
                    color={color}
                    points={[...vertices, vertices[0]]}
                    showPoints={false}
                    smooth={false}
                  />
                  <ThreeLabel
                    anchorX={dx > 0 ? "right" : "left"}
                    color={color}
                    fontSize="diagram"
                    gap={0.15}
                    position={[x, (y + insideY) / 2, 0]}
                  >
                    <InlineMath math="x" />
                  </ThreeLabel>
                  <ThreeLabel
                    anchorY={dy > 0 ? "top" : "bottom"}
                    color={color}
                    fontSize="diagram"
                    gap={0.15}
                    position={[(x + insideX) / 2, y, 0]}
                  >
                    <InlineMath math="x" />
                  </ThreeLabel>
                </group>
              );
            })}
          </CoordinateSystem>
          <p className="sr-only">
            {widthLabel} × {heightLabel}; <InlineMath math="4x^2" />.
          </p>
        </CardContent>
        <CoordinateControls />
      </Card>
    </CoordinateProvider>
  );
}
