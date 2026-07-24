import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

const cubeSize = 4;
const cubePointA = { x: cubeSize, y: 0, z: 0 };
const cubePointB = { x: cubeSize, y: cubeSize, z: 0 };
const cubePointC = { x: 0, y: cubeSize, z: 0 };
const cubePointD = { x: 0, y: 0, z: 0 };
const cubePointE = { x: cubeSize, y: 0, z: cubeSize };
const cubePointF = { x: cubeSize, y: cubeSize, z: cubeSize };
const cubePointG = { x: 0, y: cubeSize, z: cubeSize };
const cubePointH = { x: 0, y: 0, z: cubeSize };
const cubePointQ = {
  x: (cubePointF.x + cubePointG.x) / 2,
  y: (cubePointF.y + cubePointG.y) / 2,
  z: (cubePointF.z + cubePointG.z) / 2,
};
const cubePointO = { x: 3, y: 3, z: 0 };
const hiddenPoints = { showPoints: false };

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

/** Returns the midpoint between two cube points. */
function getMidpoint(pointA: typeof cubePointA, pointB: typeof cubePointA) {
  return {
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
    z: (pointA.z + pointB.z) / 2,
  };
}

/** Renders the coordinate graph for SNBT set 2 question 6. */
export function Graph({ description, title }: GraphProps) {
  return (
    <LineEquation
      cameraPosition={[9, 6, 9]}
      data={[
        // Bottom Face
        {
          ...hiddenPoints,
          points: [cubePointD, getMidpoint(cubePointD, cubePointA), cubePointA],
          color: getColor("INDIGO"),
          labels: [
            { text: "D", at: 0, offset: [-0.3, -0.3, 0] },
            { text: "4", at: 1, offset: [0, -0.3, 0] },
            { text: "A", at: 2, offset: [0.3, -0.3, 0] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointA, getMidpoint(cubePointA, cubePointB), cubePointB],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, 0, 0] }],
        },
        {
          ...hiddenPoints,
          points: [cubePointB, getMidpoint(cubePointB, cubePointC), cubePointC],
          color: getColor("INDIGO"),
          labels: [
            { text: "B", at: 0, offset: [0.3, 0.3, 0] },
            { text: "4", at: 1, offset: [0, 0.3, 0] },
            { text: "C", at: 2, offset: [-0.3, 0.3, 0] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointC, getMidpoint(cubePointC, cubePointD), cubePointD],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, 0, 0] }],
        },

        // Top Face
        {
          ...hiddenPoints,
          points: [cubePointH, getMidpoint(cubePointH, cubePointE), cubePointE],
          color: getColor("INDIGO"),
          labels: [
            { text: "H", at: 0, offset: [-0.3, -0.3, 0.3] },
            { text: "4", at: 1, offset: [0, -0.3, 0.3] },
            { text: "E", at: 2, offset: [0.3, -0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointE, getMidpoint(cubePointE, cubePointF), cubePointF],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, 0, 0.3] }],
        },
        {
          ...hiddenPoints,
          points: [cubePointF, getMidpoint(cubePointF, cubePointQ), cubePointQ],
          color: getColor("INDIGO"),
          labels: [
            { text: "F", at: 0, offset: [0.3, 0.3, 0.3] },
            { text: "2", at: 1, offset: [0, 0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointQ, getMidpoint(cubePointQ, cubePointG), cubePointG],
          color: getColor("INDIGO"),
          labels: [
            { text: "2", at: 1, offset: [0, 0.3, 0.3] },
            { text: "G", at: 2, offset: [-0.3, 0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointG, getMidpoint(cubePointG, cubePointH), cubePointH],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, 0, 0.3] }],
        },

        // Vertical Edges
        {
          ...hiddenPoints,
          points: [cubePointD, getMidpoint(cubePointD, cubePointH), cubePointH],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, -0.3, 0] }],
        },
        {
          ...hiddenPoints,
          points: [cubePointA, getMidpoint(cubePointA, cubePointE), cubePointE],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, -0.3, 0] }],
        },
        {
          ...hiddenPoints,
          points: [cubePointB, getMidpoint(cubePointB, cubePointF), cubePointF],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [0.3, 0.3, 0] }],
        },
        {
          ...hiddenPoints,
          points: [cubePointC, getMidpoint(cubePointC, cubePointG), cubePointG],
          color: getColor("INDIGO"),
          labels: [{ text: "4", at: 1, offset: [-0.3, 0.3, 0] }],
        },

        // Diagonal BD
        {
          ...hiddenPoints,
          points: [cubePointB, cubePointD],
          color: getColor("ORANGE"),
        },

        // Triangle DBQ Lines
        {
          ...hiddenPoints,
          points: [cubePointD, getMidpoint(cubePointD, cubePointQ), cubePointQ],
          color: getColor("TEAL"),
          labels: [
            { text: "6", at: 1, offset: [-0.3, 0.3, 0] },
            { text: "Q", at: 2, offset: [0, 0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointB, getMidpoint(cubePointB, cubePointQ), cubePointQ],
          color: getColor("TEAL"),
          labels: [{ text: "2√5", at: 1, offset: [0.3, 0, 0] }],
        },

        // Line HQ (from image)
        {
          ...hiddenPoints,
          points: [cubePointH, getMidpoint(cubePointH, cubePointQ), cubePointQ],
          color: getColor("VIOLET"),
          labels: [{ text: "2√5", at: 1, offset: [0, 0, 0.3] }],
        },

        // Height Line QO
        {
          ...hiddenPoints,
          points: [cubePointQ, getMidpoint(cubePointQ, cubePointO), cubePointO],
          color: getColor("ROSE"),
          labels: [
            { text: "y", at: 1, offset: [0.2, 0, 0] },
            { text: "O", at: 2, offset: [0.2, 0.2, 0] },
          ],
        },
      ]}
      description={description}
      title={title}
    />
  );
}
