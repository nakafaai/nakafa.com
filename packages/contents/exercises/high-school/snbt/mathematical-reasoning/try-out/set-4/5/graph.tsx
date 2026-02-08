import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  title: ReactNode;
  description: ReactNode;
}

export function Graph({ title, description }: GraphProps) {
  // Dimensions based on problem: p = 2l, t = l, l = l
  // DF (space diagonal) = 9
  // We use a scale factor for visualization
  const l_scale = 2;
  const p = 2 * l_scale;
  const t = l_scale;
  const l = l_scale;

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
  const highlightColor = getColor("CYAN"); // Using CYAN for the plane as in the image (light blue)

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
        { ...common, points: [A, E] },
        { ...common, points: [D, H] },
        {
          ...common,
          points: [B, F],
          labels: [
            { text: "t", at: 0.5, offset: [0.2, 0, 0], color: labelColor },
          ],
        },
        {
          ...common,
          points: [C, G],
          labels: [
            { text: "t", at: 0.5, offset: [0.2, 0, 0], color: labelColor },
          ],
        },

        // Plane ADFG (Diagonal Plane) - Highlighted
        {
          points: [A, F],
          color: highlightColor,
          showPoints: false,
        },
        {
          points: [F, G],
          color: highlightColor,
          showPoints: false,
        },
        {
          points: [G, D],
          color: highlightColor,
          showPoints: false,
        },
        {
          points: [D, A],
          color: highlightColor,
          showPoints: false,
        },
        // Fill diagonals for visual effect of the plane
        {
          points: [A, G],
          color: highlightColor,
          showPoints: false,
        },
        {
          points: [D, F],
          color: highlightColor,
          showPoints: false,
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
