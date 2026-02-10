import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  title: ReactNode;
  description: ReactNode;
}

export function Graph({ title, description }: GraphProps) {
  // Constants based on Answer Logic (to ensure consistency with calculation)
  // Note: The problem statement has geometrical inconsistencies (angles vs lengths).
  // We follow the lengths derived in the answer key to match the result (7.6 km).
  const DISTANCE_AC = 12;
  const DISTANCE_CD = 2;
  const SIN_37 = 0.6;
  const COS_37 = 0.8;

  // Calculate unscaled lengths
  const AB_LENGTH = DISTANCE_AC * SIN_37; // 7.2
  const BC_LENGTH = DISTANCE_AC * COS_37; // 9.6
  const BD_LENGTH = BC_LENGTH - DISTANCE_CD; // 7.6

  // Scale down for visualization
  const SCALE = 1.2;
  const s = (val: number) => val / SCALE;

  // Define Vertices
  // B at origin (0,0)
  const B = { x: 0, y: 0, z: 0 };
  const A = { x: 0, y: s(AB_LENGTH), z: 0 };
  const D = { x: s(BD_LENGTH), y: 0, z: 0 };
  const C = { x: s(BC_LENGTH), y: 0, z: 0 };

  // Helper to get midpoint (for labels requiring integer 'at' prop)
  const getMidpoint = (
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number }
  ) => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  });

  const midBD = getMidpoint(B, D);
  const midDC = getMidpoint(D, C);
  const midAC = getMidpoint(A, C);

  // Arc Generation Helper
  // Generates points for an arc from startAngle to endAngle
  const getArcPoints = (
    center: { x: number; y: number; z: number },
    radius: number,
    startAngleRad: number,
    endAngleRad: number,
    segments = 20
  ) => {
    const points: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngleRad + t * (endAngleRad - startAngleRad);
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        z: center.z,
      });
    }
    return points;
  };

  // Angle C Arc (37 degrees)
  // Vector CB is horizontal left (angle PI)
  // Vector CA is up-left.
  const angleCARad = Math.atan2(A.y - C.y, A.x - C.x);
  const angleCBRad = Math.PI;
  const radiusC = s(2) * 0.5; // Dynamic radius relative to CD length
  const arcCPoints = getArcPoints(C, radiusC, angleCBRad, angleCARad);
  const arcCLabelIndex = Math.floor(arcCPoints.length / 2);

  // Angle D Arc (Labeled 53 degrees)
  // Vector DB is horizontal left (angle PI)
  // Vector DA is up-left.
  const angleDARad = Math.atan2(A.y - D.y, A.x - D.x);
  const angleDBRad = Math.PI;
  const radiusD = s(2) * 0.4; // Slightly smaller radius
  const arcDPoints = getArcPoints(D, radiusD, angleDBRad, angleDARad);
  const arcDLabelIndex = Math.floor(arcDPoints.length / 2);

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Vertical Line AB
        {
          points: [B, A],
          color: getColor("INDIGO"),
          showPoints: false,
          labels: [
            { text: "B", at: 0, offset: [-0.3, -0.3, 0] },
            { text: "A", at: 1, offset: [-0.3, 0.3, 0] },
          ],
        },
        // Horizontal Segment BD (The Answer ?)
        {
          points: [B, midBD, D],
          color: getColor("EMERALD"),
          showPoints: false,
          labels: [{ text: "?", at: 1, offset: [0, -0.5, 0] }],
        },
        // Horizontal Segment DC (The 2 km movement)
        {
          points: [D, midDC, C],
          color: getColor("TEAL"),
          showPoints: false,
          labels: [
            { text: "D", at: 0, offset: [0, -0.5, 0] },
            { text: "2 km", at: 1, offset: [0, -0.8, 0] },
            { text: "C", at: 2, offset: [0, -0.5, 0] },
          ],
        },
        // Hypotenuse AC (12 km)
        {
          points: [A, midAC, C],
          color: getColor("VIOLET"),
          showPoints: false,
          labels: [{ text: "12 km", at: 1, offset: [0.5, 0.5, 0] }],
        },
        // Line AD (Line of sight from dock)
        {
          points: [A, D],
          color: getColor("ORANGE"),
          showPoints: false,
        },
        // Arc for Angle C (37 deg)
        {
          points: arcCPoints,
          color: getColor("VIOLET"),
          showPoints: false,
          labels: [
            {
              text: "37°",
              at: arcCLabelIndex,
              offset: [-0.6, 0.2, 0],
            },
          ],
        },
        // Arc for Angle D (53 deg)
        {
          points: arcDPoints,
          color: getColor("ORANGE"),
          showPoints: false,
          labels: [
            {
              text: "53°",
              at: arcDLabelIndex,
              offset: [-0.5, 0.2, 0],
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
