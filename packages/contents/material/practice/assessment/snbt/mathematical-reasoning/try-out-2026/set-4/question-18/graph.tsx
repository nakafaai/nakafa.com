import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps, ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

interface GraphPoint {
  x: number;
  y: number;
  z: number;
}

const DISTANCE_AC = 12;
const DISTANCE_CD = 2;
const SIN_37 = 0.6;
const COS_37 = 0.8;
const SCALE = 1.2;

const abLength = DISTANCE_AC * SIN_37;
const bcLength = DISTANCE_AC * COS_37;
const bdLength = bcLength - DISTANCE_CD;

const pointB = { x: 0, y: 0, z: 0 };
const pointA = { x: 0, y: scaleDistance(abLength), z: 0 };
const pointD = { x: scaleDistance(bdLength), y: 0, z: 0 };
const pointC = { x: scaleDistance(bcLength), y: 0, z: 0 };

const midAB = getMidpoint(pointA, pointB);
const midBD = getMidpoint(pointB, pointD);
const midDC = getMidpoint(pointD, pointC);
const midAC = getMidpoint(pointA, pointC);

const angleCARad = Math.atan2(pointA.y - pointC.y, pointA.x - pointC.x);
const angleDARad = Math.atan2(pointA.y - pointD.y, pointA.x - pointD.x);
const arcCPoints = getArcPoints(
  pointC,
  scaleDistance(2) * 0.5,
  Math.PI,
  angleCARad
);
const arcDPoints = getArcPoints(
  pointD,
  scaleDistance(2) * 0.4,
  Math.PI,
  angleDARad
);
const arcCLabelIndex = Math.floor(arcCPoints.length / 2);
const arcDLabelIndex = Math.floor(arcDPoints.length / 2);

const graphData = [
  {
    points: [pointB, midAB, pointA],
    color: getColor("INDIGO"),
    showPoints: false,
    labels: [
      { text: "B", at: 0, offset: [-0.3, -0.3, 0] },
      { text: "h", at: 1, offset: [-0.6, 0, 0] },
      { text: "A", at: 2, offset: [-0.3, 0.3, 0] },
    ],
  },
  {
    points: [pointB, midBD, pointD],
    color: getColor("EMERALD"),
    showPoints: false,
  },
  {
    points: [pointD, midDC, pointC],
    color: getColor("TEAL"),
    showPoints: false,
    labels: [
      { text: "D", at: 0, offset: [0, -0.5, 0] },
      { text: "2 km", at: 1, offset: [0, -0.8, 0] },
      { text: "C", at: 2, offset: [0, -0.5, 0] },
    ],
  },
  {
    points: [pointA, midAC, pointC],
    color: getColor("VIOLET"),
    showPoints: false,
    labels: [{ text: "12 km", at: 1, offset: [0.5, 0.5, 0] }],
  },
  {
    points: [pointA, pointD],
    color: getColor("ORANGE"),
    showPoints: false,
  },
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
] satisfies ComponentProps<typeof LineEquation>["data"];

/** Scales real-world distances into the chart coordinate space. */
function scaleDistance(value: number) {
  return value / SCALE;
}

/** Returns the midpoint used for stable visual labels. */
function getMidpoint(firstPoint: GraphPoint, secondPoint: GraphPoint) {
  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
    z: (firstPoint.z + secondPoint.z) / 2,
  };
}

/** Generates an arc from a start angle to an end angle. */
function getArcPoints(
  center: GraphPoint,
  radius: number,
  startAngleRad: number,
  endAngleRad: number,
  segments = 20
) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const angle = startAngleRad + t * (endAngleRad - startAngleRad);

    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      z: center.z,
    };
  });
}

export function Graph({ title, description }: GraphProps) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={graphData}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
