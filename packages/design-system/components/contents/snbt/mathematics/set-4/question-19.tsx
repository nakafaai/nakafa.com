import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import {
  getArcPoints,
  getMidpoint,
} from "@repo/design-system/components/contents/snbt/geometry";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

const distanceBc = 500;
const angleC = Math.PI / 3;
const cos60 = Math.cos(angleC);
const sin60 = Math.sin(angleC);
const scale = 90;

/** Scales real-world distance to graph units. */
function scaleDistance(value: number) {
  return value / scale;
}

const pointC = { x: 0, y: 0, z: 0 };
const pointA = { x: scaleDistance(distanceBc * cos60), y: 0, z: 0 };
const pointB = {
  x: scaleDistance(distanceBc * cos60),
  y: scaleDistance(distanceBc * sin60),
  z: 0,
};

const midpointAB = getMidpoint(pointA, pointB);
const midpointAC = getMidpoint(pointA, pointC);
const midpointBC = getMidpoint(pointB, pointC);

const angleAC = Math.atan2(pointA.y - pointC.y, pointA.x - pointC.x);
const angleBC = Math.atan2(pointB.y - pointC.y, pointB.x - pointC.x);
const arcRadius = scaleDistance(distanceBc) * 0.25;
const arcPoints = getArcPoints(pointC, arcRadius, angleAC, angleBC);
const arcLabelIndex = Math.floor(arcPoints.length / 2);

/** Renders the coordinate graph for SNBT set 4 question 19. */
export function Graph({ title, description }: GraphProps) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        {
          points: [pointA, midpointAB, pointB],
          color: getColor("INDIGO"),
          showPoints: false,
          labels: [
            { text: "A", at: 0, offset: [-0.5, -0.5, 0] },
            { text: "B", at: 2, offset: [0.5, 0.5, 0] },
          ],
        },
        {
          points: [pointA, midpointAC, pointC],
          color: getColor("EMERALD"),
          showPoints: false,
          labels: [{ text: "C", at: 2, offset: [-0.6, -0.7, 0] }],
        },
        {
          points: [pointB, midpointBC, pointC],
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
