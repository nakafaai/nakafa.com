import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  title: ReactNode;
  description: ReactNode;
}

export function Graph({ title, description }: GraphProps) {
  const DISTANCE_BC = 500;
  const ANGLE_C = Math.PI / 3;
  const COS_60 = Math.cos(ANGLE_C);
  const SIN_60 = Math.sin(ANGLE_C);

  const SCALE = 90;
  const s = (value: number) => value / SCALE;

  const C = { x: 0, y: 0, z: 0 };
  const A = { x: s(DISTANCE_BC * COS_60), y: 0, z: 0 };
  const B = {
    x: s(DISTANCE_BC * COS_60),
    y: s(DISTANCE_BC * SIN_60),
    z: 0,
  };

  const getMidpoint = (
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number }
  ) => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  });

  const midAB = getMidpoint(A, B);
  const midAC = getMidpoint(A, C);
  const midBC = getMidpoint(B, C);

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

  const angleAC = Math.atan2(A.y - C.y, A.x - C.x);
  const angleBC = Math.atan2(B.y - C.y, B.x - C.x);
  const arcRadius = s(DISTANCE_BC) * 0.25;
  const arcPoints = getArcPoints(C, arcRadius, angleAC, angleBC);
  const arcLabelIndex = Math.floor(arcPoints.length / 2);

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        {
          points: [A, midAB, B],
          color: getColor("INDIGO"),
          showPoints: false,
          labels: [
            { text: "A", at: 0, offset: [-0.5, -0.5, 0] },
            { text: "B", at: 2, offset: [0.5, 0.5, 0] },
          ],
        },
        {
          points: [A, midAC, C],
          color: getColor("EMERALD"),
          showPoints: false,
          labels: [{ text: "C", at: 2, offset: [-0.6, -0.7, 0] }],
        },
        {
          points: [B, midBC, C],
          color: getColor("CYAN"),
          showPoints: false,
          labels: [{ text: "BC = 500 m", at: 1, offset: [-1.3, 0.5, 0] }],
        },
        {
          points: arcPoints,
          color: getColor("ORANGE"),
          showPoints: false,
          labels: [
            {
              text: "60°",
              at: arcLabelIndex,
              offset: [0.6, 0.6, 0],
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
