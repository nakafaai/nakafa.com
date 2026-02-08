"use client";

import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphSolutionProps {
  title: ReactNode;
  description: ReactNode;
}

export function GraphSolution({ title, description }: GraphSolutionProps) {
  const scale = 4;
  const buildingHeight = 16 / scale; // AD
  const distanceAB = (16 * Math.sqrt(3)) / scale; // AB
  const helicopterHeight = distanceAB * Math.tan(Math.PI / 4); // AC
  const shadowLength = 2; // BE (x)
  const totalGround = distanceAB + shadowLength; // AE
  const labelOffsetX = totalGround * 0.08;
  const labelOffsetY = buildingHeight * 0.5;
  const angleRadius30 = distanceAB * 0.25;
  const angleRadius45 = distanceAB * 0.35;
  const arcSegments = 40;
  const angle30 = (30 * Math.PI) / 180;
  const angle45 = (45 * Math.PI) / 180;
  const arc30Start = Math.PI - angle30;
  const arc45Start = Math.PI - angle45;
  const arcBase = Math.PI;

  const arc30Points = Array.from({ length: arcSegments + 1 }, (_, index) => {
    const t = index / arcSegments;
    const theta = arc30Start + (arcBase - arc30Start) * t;
    return {
      x: distanceAB + angleRadius30 * Math.cos(theta),
      y: angleRadius30 * Math.sin(theta),
      z: 0,
    };
  });

  const arc45Points = Array.from({ length: arcSegments + 1 }, (_, index) => {
    const t = index / arcSegments;
    const theta = arc45Start + (arcBase - arc45Start) * t;
    return {
      x: distanceAB + angleRadius45 * Math.cos(theta),
      y: angleRadius45 * Math.sin(theta),
      z: 0,
    };
  });

  const arc30LabelIndex = Math.floor(arcSegments * 0.5);
  const arc45LabelIndex = Math.floor(arcSegments * 0.5);

  // Points
  const A = { x: 0, y: 0, z: 0 };
  const B = { x: distanceAB, y: 0, z: 0 };
  const C = { x: 0, y: helicopterHeight, z: 0 };
  const D = { x: 0, y: buildingHeight, z: 0 };
  const E = { x: totalGround, y: 0, z: 0 };

  // Midpoints for labels
  const midAD = { x: 0, y: buildingHeight / 2, z: 0 };
  const midAB = { x: distanceAB / 2, y: 0, z: 0 };
  const midBE = { x: distanceAB + shadowLength / 2, y: 0, z: 0 };

  // Dimension line Y position
  const dimensionY = -labelOffsetY * 0.6;
  const observerHeight = 2;

  return (
    <LineEquation
      cameraPosition={[0, 0, 18]}
      data={[
        // Vertical Line AC (A -> D -> C)
        {
          points: [A, midAD, D],
          color: getColor("INDIGO"),
          showPoints: false,
          labels: [
            {
              text: "A",
              at: 0,
              offset: [-labelOffsetX * 0.3, labelOffsetY * 0.2, 0],
              color: getColor("INDIGO"),
            },
            {
              text: "16 m",
              at: 1,
              offset: [-labelOffsetX, 0, 0],
              color: getColor("INDIGO"),
            },
            {
              text: "Gedung",
              at: 1,
              offset: [-labelOffsetX * 1.8, -labelOffsetY * 0.3, 0],
              color: getColor("INDIGO"),
            },
            {
              text: "D",
              at: 2,
              offset: [-labelOffsetX * 0.3, 0, 0],
              color: getColor("INDIGO"),
            },
          ],
        },
        {
          points: [D, C],
          color: getColor("ORANGE"),
          showPoints: false,
          labels: [
            {
              text: "Helikopter",
              at: 1,
              offset: [labelOffsetX * 0.3, labelOffsetY * 0.4, 0],
              color: getColor("ORANGE"),
            },
            {
              text: "C",
              at: 1,
              offset: [-labelOffsetX * 0.3, 0, 0],
              color: getColor("ORANGE"),
            },
          ],
        },
        // Horizontal Line AE (A -> B -> E)
        {
          points: [A, midAB, B],
          color: getColor("TEAL"),
          showPoints: false,
          labels: [
            {
              text: "(32 - x) m",
              at: 1,
              offset: [0, -labelOffsetY * 0.3, 0],
              color: getColor("TEAL"),
            },
            {
              text: "B",
              at: 2,
              offset: [0, labelOffsetY * 0.2, 0],
              color: getColor("TEAL"),
            },
          ],
        },
        {
          points: [B, midBE, E],
          color: getColor("CYAN"),
          showPoints: false,
          labels: [
            {
              text: "x",
              at: 1,
              offset: [0, -labelOffsetY * 0.3, 0],
              color: getColor("CYAN"),
            },
            {
              text: "E",
              at: 2,
              offset: [labelOffsetX, labelOffsetY * 0.2, 0],
              color: getColor("CYAN"),
            },
          ],
        },
        // Observer
        {
          points: [E, { x: E.x, y: observerHeight, z: 0 }],
          color: getColor("CYAN"),
          showPoints: false,
          labels: [
            {
              text: "Pengamat",
              at: 1,
              offset: [0, labelOffsetY * 0.3, 0],
              color: getColor("CYAN"),
            },
          ],
        },
        // Hypotenuse DB
        {
          points: [D, B],
          color: getColor("VIOLET"),
          showPoints: false,
        },
        // Hypotenuse CB
        {
          points: [C, B],
          color: getColor("EMERALD"),
          showPoints: false,
        },
        // Bottom Dimension 32m
        {
          points: [
            { x: 0, y: dimensionY, z: 0 },
            { x: totalGround / 2, y: dimensionY, z: 0 },
            { x: totalGround, y: dimensionY, z: 0 },
          ],
          color: getColor("ROSE"),
          showPoints: false,
          cone: { position: "both" },
          labels: [
            {
              text: "32 m",
              at: 1,
              offset: [0, -labelOffsetY * 0.4, 0],
              color: getColor("ROSE"),
            },
          ],
        },
        // Angles
        {
          points: arc30Points,
          color: getColor("VIOLET"),
          showPoints: false,
          labels: [
            {
              text: "30°",
              at: arc30LabelIndex,
              offset: [-labelOffsetX * 0.6, labelOffsetY * 0.05, 0],
              color: getColor("VIOLET"),
            },
          ],
        },
        {
          points: arc45Points,
          color: getColor("EMERALD"),
          showPoints: false,
          labels: [
            {
              text: "45°",
              at: arc45LabelIndex,
              offset: [-labelOffsetX * 0.8, labelOffsetY * 0.15, 0],
              color: getColor("EMERALD"),
            },
          ],
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
