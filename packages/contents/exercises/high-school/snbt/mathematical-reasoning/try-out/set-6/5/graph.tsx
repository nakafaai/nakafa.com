"use client";

import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  title: ReactNode;
  description: ReactNode;
}

export const Graph = ({ title, description }: GraphProps) => {
  // Constants for Cone 1 (R1 = h1)
  const R1 = 3;
  const H1 = 3;
  const SEGMENTS = 64;

  // Constants for Cone 2 (R2 = 2h2)
  const R2 = 4;
  const H2 = 2;

  // Positioning: Centered around origin
  const DISTANCE = 10;
  const OFFSET = DISTANCE / 2;
  const C1_X = -OFFSET; // -5
  const C2_X = OFFSET; // 5

  // Colors
  const COLOR_CONE_1 = getColor("INDIGO");
  const COLOR_CONE_2 = getColor("TEAL");
  const COLOR_HELPER = getColor("ORANGE");
  const COLOR_LABEL = getColor("SLATE");

  // Helper to generate circle points in XZ plane (Base on ground y=0)
  const createCircle = (cx: number, cz: number, r: number) => {
    return Array.from({ length: SEGMENTS + 1 }, (_, i) => {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      return {
        x: cx + r * Math.cos(angle),
        y: 0,
        z: cz + r * Math.sin(angle),
      };
    });
  };

  // Cone 1 Geometry (Center P1 at C1_X, 0, 0)
  const cone1Base = createCircle(C1_X, 0, R1);
  const cone1Apex = { x: C1_X, y: H1, z: 0 };
  const cone1Slants = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(
    (angle) => [
      cone1Apex,
      {
        x: C1_X + R1 * Math.cos(angle),
        y: 0,
        z: R1 * Math.sin(angle),
      },
    ]
  );
  const cone1HeightLine = [{ x: C1_X, y: 0, z: 0 }, cone1Apex];
  const cone1RadiusLine = [
    { x: C1_X, y: 0, z: 0 },
    { x: C1_X + R1, y: 0, z: 0 },
  ];

  // Cone 2 Geometry (Center P2 at C2_X, 0, 0)
  const cone2Base = createCircle(C2_X, 0, R2);
  const cone2Apex = { x: C2_X, y: H2, z: 0 };
  const cone2Slants = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(
    (angle) => [
      cone2Apex,
      {
        x: C2_X + R2 * Math.cos(angle),
        y: 0,
        z: R2 * Math.sin(angle),
      },
    ]
  );
  const cone2HeightLine = [{ x: C2_X, y: 0, z: 0 }, cone2Apex];
  const cone2RadiusLine = [
    { x: C2_X, y: 0, z: 0 },
    { x: C2_X + R2, y: 0, z: 0 },
  ];

  return (
    <LineEquation
      cameraPosition={[0, 8, 15]}
      data={[
        // --- Cone 1 ---
        {
          points: cone1Base,
          color: COLOR_CONE_1,
          smooth: true,
          showPoints: false,
          lineWidth: 2,
        },
        ...cone1Slants.map((points) => ({
          points,
          color: COLOR_CONE_1,
          showPoints: false,
          lineWidth: 1,
        })),
        // Height (h1) and P1
        {
          points: cone1HeightLine,
          color: COLOR_HELPER,
          showPoints: true, // Shows P1 and Apex
          lineWidth: 2,
          labels: [
            {
              text: "h₁",
              at: 0,
              offset: [0.2, H1 / 2, 0],
              color: COLOR_LABEL,
            },
            {
              text: "P₁",
              at: 0,
              offset: [0, -0.5, 0],
              color: COLOR_LABEL,
            },
          ],
        },
        // Radius (R1)
        {
          points: cone1RadiusLine,
          color: COLOR_HELPER,
          showPoints: false,
          lineWidth: 2,
          labels: [
            {
              text: "R₁",
              at: 0,
              offset: [R1 / 2, -0.5, 0],
              color: COLOR_LABEL,
            },
          ],
        },

        // --- Cone 2 ---
        {
          points: cone2Base,
          color: COLOR_CONE_2,
          smooth: true,
          showPoints: false,
          lineWidth: 2,
        },
        ...cone2Slants.map((points) => ({
          points,
          color: COLOR_CONE_2,
          showPoints: false,
          lineWidth: 1,
        })),
        // Height (h2) and P2
        {
          points: cone2HeightLine,
          color: COLOR_HELPER,
          showPoints: true,
          lineWidth: 2,
          labels: [
            {
              text: "h₂",
              at: 0,
              offset: [0.2, H2 / 2, 0],
              color: COLOR_LABEL,
            },
            {
              text: "P₂",
              at: 0,
              offset: [0, -0.5, 0],
              color: COLOR_LABEL,
            },
          ],
        },
        // Radius (R2)
        {
          points: cone2RadiusLine,
          color: COLOR_HELPER,
          showPoints: false,
          lineWidth: 2,
          labels: [
            {
              text: "R₂",
              at: 0,
              offset: [R2 / 2, -0.5, 0],
              color: COLOR_LABEL,
            },
          ],
        },
      ]}
      // Camera looking at center (0,0,0) from slightly above and front
      description={description}
      title={title}
    />
  );
};
