import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

/** Renders the coordinate graph for SNBT set 6 question 5. */
export function Graph({ title, description }: GraphProps) {
  // Constants for Cone 1 (R1 = h1)
  const R1 = 3;
  const H1 = R1;
  const SEGMENTS = 64;

  // Equal volumes with R2 = 2h2 require R2³ = 2R1³.
  const R2 = R1 * Math.cbrt(2);
  const H2 = R2 / 2;

  // Positioning: Centered around origin
  const DISTANCE = 10;
  const OFFSET = DISTANCE / 2;
  const C1_X = -OFFSET; // -5

  // Colors
  const COLOR_CONE_1 = getColor("INDIGO");
  const COLOR_CONE_2 = getColor("TEAL");
  const COLOR_HELPER = getColor("ORANGE");

  /** Samples one horizontal cone base in the XZ plane. */
  const createCircle = (cx: number, cz: number, r: number) =>
    Array.from({ length: SEGMENTS + 1 }, (_, i) => {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      return {
        x: cx + r * Math.cos(angle),
        y: 0,
        z: cz + r * Math.sin(angle),
      };
    });

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

  // Cone 2 Geometry (Center P2 at OFFSET, 0, 0)
  const cone2Base = createCircle(OFFSET, 0, R2);
  const cone2Apex = { x: OFFSET, y: H2, z: 0 };
  const cone2Slants = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map(
    (angle) => [
      cone2Apex,
      {
        x: OFFSET + R2 * Math.cos(angle),
        y: 0,
        z: R2 * Math.sin(angle),
      },
    ]
  );
  const cone2HeightLine = [{ x: OFFSET, y: 0, z: 0 }, cone2Apex];
  const cone2RadiusLine = [
    { x: OFFSET, y: 0, z: 0 },
    { x: OFFSET + R2, y: 0, z: 0 },
  ];

  return (
    <LineEquation
      cameraPosition={[0, 8, 15]}
      data={[
        // --- Cone 1 ---
        {
          points: cone1Base,
          color: COLOR_CONE_1,
          smooth: false,
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
              text: <InlineMath math="h_1" />,
              at: 0,
              offset: [0.2, H1 / 2, 0],
            },
            {
              text: <InlineMath math="P_1" />,
              at: 0,
              offset: [0, -0.5, 0],
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
              text: <InlineMath math="R_1" />,
              at: 0,
              offset: [R1 / 2, -0.5, 0],
            },
          ],
        },

        // --- Cone 2 ---
        {
          points: cone2Base,
          color: COLOR_CONE_2,
          smooth: false,
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
              text: <InlineMath math="h_2" />,
              at: 0,
              offset: [0.2, H2 / 2, 0],
            },
            {
              text: <InlineMath math="P_2" />,
              at: 0,
              offset: [0, -0.5, 0],
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
              text: <InlineMath math="R_2" />,
              at: 0,
              offset: [R2 / 2, -0.5, 0],
            },
          ],
        },
      ]}
      // Camera looking at center (0,0,0) from slightly above and front
      description={description}
      title={title}
    />
  );
}
