import { LineSceneCard } from "@repo/design-system/components/contents/mathematics/line/card";
import { LineEquationProvider } from "@repo/design-system/components/contents/mathematics/line/context";
import type { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { resolveLineScene } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualCardHeader } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

/** Renders the quantitative graph for SNBT set 10 question 2. */
export function Graph({
  description,
  title,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  const LENGTH = 5;
  const ANGLE = (40 * Math.PI) / 180; // 40 degrees

  // Horizontal Line
  const horizontalPointsWithCenter = [
    { x: -LENGTH, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: LENGTH, y: 0, z: 0 },
  ];

  // Diagonal 1 (Top-Left to Bottom-Right)
  // Angle is 180 - 40 = 140 degrees
  const d1Angle = Math.PI - ANGLE;
  const d1PointsWithCenter = [
    { x: LENGTH * Math.cos(d1Angle), y: LENGTH * Math.sin(d1Angle), z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -LENGTH * Math.cos(d1Angle), y: -LENGTH * Math.sin(d1Angle), z: 0 },
  ];

  // Diagonal 2 (Top-Right to Bottom-Left)
  // Angle is 40 degrees
  const d2PointsWithCenter = [
    { x: LENGTH * Math.cos(ANGLE), y: LENGTH * Math.sin(ANGLE), z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -LENGTH * Math.cos(ANGLE), y: -LENGTH * Math.sin(ANGLE), z: 0 },
  ];

  const config = resolveLineScene({
    cameraPosition: [0, 0, 13.5],
    data: [
      {
        points: horizontalPointsWithCenter,
        color: getColor("INDIGO"),
        showPoints: false,
        smooth: false,
        cone: { position: "both", size: 0.5 },
      },
      {
        points: d1PointsWithCenter,
        color: getColor("INDIGO"),
        showPoints: false,
        smooth: false,
        cone: { position: "both", size: 0.5 },
        labels: [
          {
            text: <InlineMath math="x^\circ" />,
            at: 1, // Center point
            offset: [-1.2, 0.4, 0], // Adjusted for x position
          },
        ],
      },
      {
        points: d2PointsWithCenter,
        color: getColor("INDIGO"),
        showPoints: false,
        smooth: false,
        cone: { position: "both", size: 0.5 },
        labels: [
          {
            text: <InlineMath math="y^\circ" />,
            at: 1, // Center point
            offset: [1.2, 0.4, 0], // Adjusted for y position
            fontSize: 0.6,
          },
          {
            text: <InlineMath math="z^\circ" />,
            at: 1, // Center point
            offset: [0, -0.8, 0], // Adjusted for z position
            fontSize: 0.6,
          },
        ],
      },
    ],
  });

  return (
    <LineEquationProvider config={config}>
      <LineSceneCard>
        <VisualCardHeader description={description} title={title} />
      </LineSceneCard>
    </LineEquationProvider>
  );
}
