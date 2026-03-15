import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

export function Graph(
  props: Pick<ComponentProps<typeof LineEquation>, "title" | "description">
) {
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
  const d2Angle = ANGLE;
  const d2PointsWithCenter = [
    { x: LENGTH * Math.cos(d2Angle), y: LENGTH * Math.sin(d2Angle), z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -LENGTH * Math.cos(d2Angle), y: -LENGTH * Math.sin(d2Angle), z: 0 },
  ];

  const refinedData: ComponentProps<typeof LineEquation>["data"] = [
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
          text: "x°",
          at: 1, // Center point
          offset: [-1.2, 0.4, 0], // Adjusted for x position
          color: getColor("TEAL"),
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
          text: "y°",
          at: 1, // Center point
          offset: [1.2, 0.4, 0], // Adjusted for y position
          fontSize: 0.6,
          color: getColor("TEAL"),
        },
        {
          text: "z°",
          at: 1, // Center point
          offset: [0, -0.8, 0], // Adjusted for z position
          fontSize: 0.6,
          color: getColor("TEAL"),
        },
      ],
    },
  ];

  return (
    <LineEquation
      cameraPosition={[0, 0, 10]}
      data={refinedData}
      showZAxis={false}
      {...props}
    />
  );
}
