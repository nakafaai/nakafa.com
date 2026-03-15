import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  label: {
    horizontal: string;
  };
  title: ReactNode;
}

export function Graph({ title, description, label }: GraphProps) {
  // Scaling factors
  // Real dimensions: Height = 60m, Width = 180m
  // We want to scale this down to reasonable graph coordinates
  // Let's divide by 20.
  // Height = 3 units, Width = 9 units
  const SCALE = 20;
  const H_REAL = 60;
  const W_REAL = 180;

  const H_GRAPH = H_REAL / SCALE; // 3
  const W_GRAPH = W_REAL / SCALE; // 9

  // Coordinates
  // We center the triangle at (0,0) for better camera positioning at [0, 0, Z]
  // Original: B(0,0), A(0, H), C(W, 0)
  // Center: (W/2, H/2)
  // Shift: -W/2, -H/2

  const shiftX = -W_GRAPH / 2;
  const shiftY = -H_GRAPH / 2;

  const B = { x: 0 + shiftX, y: 0 + shiftY, z: 0 };
  const A = { x: 0 + shiftX, y: H_GRAPH + shiftY, z: 0 };
  const C = { x: W_GRAPH + shiftX, y: 0 + shiftY, z: 0 };

  // Helper points for labels (Midpoints)
  // We need 3 points for lines with labels in the middle to use integer 'at' index
  const MidAB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, z: (A.z + B.z) / 2 };
  const MidBC = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2, z: (B.z + C.z) / 2 };

  // Horizontal line extension
  const HorizontalLen = 4;
  const HorizontalEnd = { x: A.x + HorizontalLen, y: A.y, z: 0 };
  const MidHorizontal = { x: A.x + HorizontalLen / 2, y: A.y, z: 0 };

  // Person Height (173 cm = 1.73 m)
  // Use a fixed visual height because true scale (1.73/20 = 0.08) is too small to see
  const H_PERSON_GRAPH = 2;

  const B_Ground = { x: B.x, y: B.y - H_PERSON_GRAPH, z: 0 };
  const B_Mid = { x: B.x, y: B.y - H_PERSON_GRAPH / 2, z: 0 };

  const C_Ground = { x: C.x, y: C.y - H_PERSON_GRAPH, z: 0 };
  const C_Mid = { x: C.x, y: C.y - H_PERSON_GRAPH / 2, z: 0 };

  // Angle Arcs
  const ARC_RADIUS = 1.5;
  const angleAlpha = Math.atan(H_REAL / W_REAL); // Radians

  // Arc A (Depression): 0 to -alpha
  const arcA_points = Array.from({ length: 16 }, (_, i) => {
    const theta = 0 + (-angleAlpha - 0) * (i / 15);
    return {
      x: A.x + ARC_RADIUS * Math.cos(theta),
      y: A.y + ARC_RADIUS * Math.sin(theta),
      z: 0,
    };
  });

  // Arc C (Elevation): PI to PI - alpha
  const arcC_points = Array.from({ length: 16 }, (_, i) => {
    const theta = Math.PI + (Math.PI - angleAlpha - Math.PI) * (i / 15);
    return {
      x: C.x + ARC_RADIUS * Math.cos(theta),
      y: C.y + ARC_RADIUS * Math.sin(theta),
      z: 0,
    };
  });

  // Colors
  const COLOR_TRIANGLE = getColor("INDIGO");
  const COLOR_SIGHT = getColor("ROSE");
  const COLOR_LABEL = getColor("VIOLET");
  const COLOR_AUX = getColor("AMBER");

  return (
    <LineEquation
      cameraPosition={[0, 0, 12]}
      data={[
        // Horizontal line of sight (for angle of depression)
        {
          points: [A, MidHorizontal, HorizontalEnd],
          color: COLOR_SIGHT,
          showPoints: false,
          lineWidth: 2,
          smooth: false,
          labels: [
            {
              text: label.horizontal,
              at: 1,
              offset: [0, 0.5, 0],
              color: COLOR_SIGHT,
            },
          ],
        },
        // Hypotenuse (Line of sight to target)
        {
          points: [A, C],
          color: COLOR_SIGHT,
          showPoints: false,
          lineWidth: 2,
          smooth: false,
        },
        // Vertical Height Label (60 m)
        {
          points: [A, MidAB, B],
          color: COLOR_LABEL,
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: "60 m",
              at: 1, // midpoint
              offset: [-1, 0, 0],
              color: COLOR_LABEL,
            },
          ],
        },
        // Horizontal Distance Label (180 m)
        {
          points: [B, MidBC, C],
          color: COLOR_LABEL,
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: "180 m",
              at: 1,
              offset: [0, -1, 0],
              color: COLOR_LABEL,
            },
          ],
        },
        // Angle alpha Arcs
        {
          points: arcA_points,
          color: COLOR_AUX,
          showPoints: false,
          smooth: false,
          lineWidth: 2,
        },
        {
          points: arcC_points,
          color: COLOR_AUX,
          showPoints: false,
          smooth: false,
          lineWidth: 2,
        },
        // Angle alpha Labels (Anchors)
        {
          points: [
            {
              x: A.x + 2.0 * Math.cos(-angleAlpha / 2),
              y: A.y + 2.0 * Math.sin(-angleAlpha / 2),
              z: 0,
            },
          ],
          color: COLOR_AUX,
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: "a",
              at: 0,
              offset: [0, 0, 0],
              color: COLOR_AUX,
            },
          ],
        },
        {
          points: [
            {
              x: C.x - 2.0 * Math.cos(angleAlpha / 2),
              y: C.y + 2.0 * Math.sin(angleAlpha / 2),
              z: 0,
            },
          ],
          color: COLOR_AUX,
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: "a",
              at: 0,
              offset: [0, 0, 0],
              color: COLOR_AUX,
            },
          ],
        },
        // Person Height Lines (173 cm)
        {
          points: [B, B_Mid, B_Ground],
          color: COLOR_LABEL,
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: "173 cm",
              at: 1,
              offset: [-0.8, 0, 0],
              color: COLOR_LABEL,
            },
          ],
        },
        {
          points: [C, C_Mid, C_Ground],
          color: COLOR_LABEL,
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: "173 cm",
              at: 1,
              offset: [0.8, 0, 0],
              color: COLOR_LABEL,
            },
          ],
        },
        // Points
        {
          points: [A],
          color: COLOR_TRIANGLE,
          showPoints: true,
          smooth: false,
          labels: [
            { text: "A", at: 0, offset: [-0.5, 0.5, 0], color: COLOR_TRIANGLE },
          ],
        },
        {
          points: [B],
          color: COLOR_TRIANGLE,
          showPoints: true,
          smooth: false,
          labels: [
            {
              text: "B",
              at: 0,
              offset: [-0.5, -0.5, 0],
              color: COLOR_TRIANGLE,
            },
          ],
        },
        {
          points: [C],
          color: COLOR_TRIANGLE,
          showPoints: true,
          smooth: false,
          labels: [
            { text: "C", at: 0, offset: [0.5, -0.5, 0], color: COLOR_TRIANGLE },
          ],
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
