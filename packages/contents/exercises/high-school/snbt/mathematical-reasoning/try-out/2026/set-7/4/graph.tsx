import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

export function Graph({ title, description }: GraphProps) {
  // Cube Dimensions (Edge = 5)
  const SIDE = 5;
  const HALF = SIDE / 2;

  // Vertices (Centered at origin, y is up)
  // Bottom face (y = -HALF)
  const A = { x: -HALF, y: -HALF, z: HALF };
  const B = { x: HALF, y: -HALF, z: HALF };
  const C = { x: HALF, y: -HALF, z: -HALF };
  const D = { x: -HALF, y: -HALF, z: -HALF };

  // Top face (y = HALF)
  const E = { x: -HALF, y: HALF, z: HALF };
  const F = { x: HALF, y: HALF, z: HALF };
  const G = { x: HALF, y: HALF, z: -HALF };
  const H = { x: -HALF, y: HALF, z: -HALF };

  // Center Point
  const CENTER = { x: 0, y: 0, z: 0 };

  // Point on floor directly below center
  const FLOOR_CENTER = { x: 0, y: -HALF, z: 0 };

  // Midpoint for distance line label
  const MID_DISTANCE = { x: 0, y: -HALF / 2, z: 0 };

  // Colors
  const COLOR_CUBE = getColor("INDIGO");
  const COLOR_DIAGONAL = getColor("ROSE");
  const COLOR_DISTANCE = getColor("AMBER");
  const COLOR_LABEL = getColor("VIOLET");

  // Edges of the cube
  const cubeEdges = [
    // Bottom face
    [A, B],
    [B, C],
    [C, D],
    [D, A],
    // Top face
    [E, F],
    [F, G],
    [G, H],
    [H, E],
    // Vertical edges
    [A, E],
    [B, F],
    [C, G],
    [D, H],
  ];

  // Main Diagonals (intersecting at center)
  const diagonals = [
    [A, G],
    [B, H],
    [C, E],
    [D, F],
  ];

  return (
    <LineEquation
      cameraPosition={[8, 6, 10]}
      data={[
        // Cube Edges
        ...cubeEdges.map((edge) => ({
          points: edge,
          color: COLOR_CUBE,
          showPoints: false,
          lineWidth: 2,
        })),

        // Diagonals
        ...diagonals.map((edge) => ({
          points: edge,
          color: COLOR_DIAGONAL,
          showPoints: false,
          lineWidth: 2,
        })),

        // Distance Line (Center to Floor)
        {
          points: [CENTER, MID_DISTANCE, FLOOR_CENTER],
          color: COLOR_DISTANCE,
          showPoints: false,
          lineWidth: 3,
          labels: [
            {
              text: "2.5m",
              at: 1,
              offset: [1, 0, 0],
              color: COLOR_DISTANCE,
            },
          ],
        },
        // Distance Line Endpoints
        {
          points: [CENTER],
          color: COLOR_DISTANCE,
          showPoints: true,
        },
        {
          points: [FLOOR_CENTER],
          color: COLOR_DISTANCE,
          showPoints: true,
        },

        // Labels for Vertices
        {
          points: [A],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "A", at: 0, offset: [-0.5, -0.5, 0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [B],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "B", at: 0, offset: [0.5, -0.5, 0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [C],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "C", at: 0, offset: [0.5, -0.5, -0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [D],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            {
              text: "D",
              at: 0,
              offset: [-0.5, -0.5, -0.5],
              color: COLOR_LABEL,
            },
          ],
        },
        {
          points: [E],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "E", at: 0, offset: [-0.5, 0.5, 0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [F],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "F", at: 0, offset: [0.5, 0.5, 0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [G],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "G", at: 0, offset: [0.5, 0.5, -0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [H],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "H", at: 0, offset: [-0.5, 0.5, -0.5], color: COLOR_LABEL },
          ],
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
