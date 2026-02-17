import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  title: ReactNode;
  description: ReactNode;
}

export function Graph({ title, description }: GraphProps) {
  // Cube Dimensions
  const SIDE = 4;
  const HALF = SIDE / 2;

  // Vertices (Centered at origin)
  // D is back-left-bottom (-x, -y, -z)
  const D = { x: -HALF, y: -HALF, z: -HALF };
  const A = { x: -HALF, y: -HALF, z: HALF };
  const B = { x: HALF, y: -HALF, z: HALF };
  const C = { x: HALF, y: -HALF, z: -HALF };
  const H = { x: -HALF, y: HALF, z: -HALF };
  const E = { x: -HALF, y: HALF, z: HALF };
  const F = { x: HALF, y: HALF, z: HALF };
  const G = { x: HALF, y: HALF, z: -HALF };

  // Colors
  const COLOR_CUBE = getColor("INDIGO");
  const COLOR_TRIANGLE = getColor("ROSE");
  const COLOR_DIAGONAL = getColor("AMBER");
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

  // Triangle HDF edges
  const triangleEdges = [
    [H, D],
    [D, F],
    [F, H],
  ];

  // Midpoints for labels
  const midDF = {
    x: (D.x + F.x) / 2,
    y: (D.y + F.y) / 2,
    z: (D.z + F.z) / 2,
  };

  const midHF = {
    x: (H.x + F.x) / 2,
    y: (H.y + F.y) / 2,
    z: (H.z + F.z) / 2,
  };

  return (
    <LineEquation
      cameraPosition={[8, 6, 12]}
      data={[
        // Cube Edges
        ...cubeEdges.map((edge) => ({
          points: edge,
          color: COLOR_CUBE,
          showPoints: false,
          lineWidth: 2,
        })),

        // Triangle HDF
        ...triangleEdges.map((edge) => ({
          points: edge,
          color: COLOR_TRIANGLE,
          showPoints: false,
          lineWidth: 3,
        })),

        // Diagonal DF (Hypotenuse)
        {
          points: [D, midDF, F],
          color: COLOR_DIAGONAL,
          showPoints: false,
          lineWidth: 3,
          labels: [
            {
              text: "DF",
              at: 1, // Midpoint index
              offset: [0.5, 0.5, 0],
              color: COLOR_LABEL,
            },
          ],
        },

        // Diagonal HF (Opposite)
        {
          points: [H, midHF, F],
          color: COLOR_DIAGONAL,
          showPoints: false,
          lineWidth: 3,
          labels: [
            {
              text: "HF",
              at: 1, // Midpoint index
              offset: [0, 0.5, 0],
              color: COLOR_LABEL,
            },
          ],
        },

        // Labels for Vertices
        {
          points: [D],
          color: COLOR_LABEL,
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
          points: [H],
          color: COLOR_LABEL,
          showPoints: true,
          labels: [
            { text: "H", at: 0, offset: [-0.5, 0.5, -0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [F],
          color: COLOR_LABEL,
          showPoints: true,
          labels: [
            { text: "F", at: 0, offset: [0.5, 0.5, 0.5], color: COLOR_LABEL },
          ],
        },
        {
          points: [A],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "A", at: 0, offset: [-0.5, -0.5, 0.5], color: COLOR_CUBE },
          ],
        },
        {
          points: [B],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "B", at: 0, offset: [0.5, -0.5, 0.5], color: COLOR_CUBE },
          ],
        },
        {
          points: [C],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "C", at: 0, offset: [0.5, -0.5, -0.5], color: COLOR_CUBE },
          ],
        },
        {
          points: [E],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "E", at: 0, offset: [-0.5, 0.5, 0.5], color: COLOR_CUBE },
          ],
        },
        {
          points: [G],
          color: COLOR_CUBE,
          showPoints: true,
          labels: [
            { text: "G", at: 0, offset: [0.5, 0.5, -0.5], color: COLOR_CUBE },
          ],
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
