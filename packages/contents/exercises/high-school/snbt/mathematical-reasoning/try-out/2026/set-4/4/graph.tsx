import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

export function Graph({ title, description }: GraphProps) {
  // Dimensions based on problem: p = 2l, l = l, t = l
  // We use a scale factor for visualization
  const l_scale = 2;
  const p = 2 * l_scale; // 4
  const t = l_scale; // 2
  const l = l_scale; // 2

  // Center the box at (0,0,0)
  const xMin = -p / 2;
  const xMax = p / 2;
  const yMin = -t / 2;
  const yMax = t / 2;
  const zMin = -l / 2;
  const zMax = l / 2;

  // Vertices
  const A = { x: xMin, y: yMin, z: zMax }; // Front-Left-Bottom
  const B = { x: xMax, y: yMin, z: zMax }; // Front-Right-Bottom
  const C = { x: xMax, y: yMin, z: zMin }; // Back-Right-Bottom
  const D = { x: xMin, y: yMin, z: zMin }; // Back-Left-Bottom

  const E = { x: xMin, y: yMax, z: zMax }; // Front-Left-Top
  const F = { x: xMax, y: yMax, z: zMax }; // Front-Right-Top
  const G = { x: xMax, y: yMax, z: zMin }; // Back-Right-Top
  const H = { x: xMin, y: yMax, z: zMin }; // Back-Left-Top

  const common = { showPoints: false, color: getColor("INDIGO") };
  const labelColor = getColor("INDIGO");
  const highlightColor = getColor("ORANGE");
  const auxColor = getColor("TEAL");

  const getMidpoint = (
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number }
  ) => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  });

  return (
    <LineEquation
      cameraPosition={[5, 3, 7]}
      data={[
        // Bottom Face Edges
        {
          ...common,
          points: [A, getMidpoint(A, B), B],
          labels: [
            { text: "A", at: 0, offset: [-0.2, -0.2, 0.2], color: labelColor },
            { text: "B", at: 2, offset: [0.2, -0.2, 0.2], color: labelColor },
            { text: "p = 2l", at: 1, offset: [0, -0.4, 0], color: labelColor },
          ],
        },
        {
          ...common,
          points: [B, getMidpoint(B, C), C],
          labels: [
            { text: "C", at: 2, offset: [0.2, -0.2, -0.2], color: labelColor },
            { text: "l", at: 1, offset: [0.4, 0, 0], color: labelColor },
          ],
        },
        {
          ...common,
          points: [C, D],
          labels: [
            {
              text: "D",
              at: 1,
              offset: [-0.2, -0.2, -0.2],
              color: labelColor,
            },
          ],
        },
        {
          ...common,
          points: [D, getMidpoint(D, A), A],
          labels: [
            { text: "l", at: 1, offset: [-0.4, 0, 0], color: labelColor },
          ],
        },

        // Top Face Edges
        {
          ...common,
          points: [E, F],
          labels: [
            { text: "E", at: 0, offset: [-0.2, 0.2, 0.2], color: labelColor },
            { text: "F", at: 1, offset: [0.2, 0.2, 0.2], color: labelColor },
          ],
        },
        {
          ...common,
          points: [F, G],
          labels: [
            { text: "G", at: 1, offset: [0.2, 0.2, -0.2], color: labelColor },
          ],
        },
        {
          ...common,
          points: [G, H],
          labels: [
            { text: "H", at: 1, offset: [-0.2, 0.2, -0.2], color: labelColor },
          ],
        },
        {
          ...common,
          points: [H, E],
        },

        // Vertical Edges
        {
          ...common,
          points: [A, E],
        },
        {
          ...common,
          points: [B, getMidpoint(B, F), F],
          labels: [
            { text: "t = l", at: 1, offset: [0.4, 0, 0], color: labelColor },
          ],
        },
        {
          ...common,
          points: [C, G],
        },
        {
          ...common,
          points: [D, H],
        },

        // Diagonal DF (Space Diagonal)
        {
          points: [D, getMidpoint(D, F), F],
          color: highlightColor,
          showPoints: false,
          labels: [
            { text: "9", at: 1, offset: [0, 0.5, 0], color: highlightColor },
          ],
        },
        // Diagonal DB (Base Diagonal)
        {
          points: [D, B],
          color: auxColor,
          showPoints: false,
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
