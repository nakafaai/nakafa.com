import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

interface GraphProps
  extends Pick<ComponentProps<typeof LineEquation>, "title" | "description"> {
  mode?: "question" | "answer";
}

const vertexPoint = { x: -1, y: 0, z: 0 };
const topY = 2;
const topX = vertexPoint.x + topY / Math.tan((25 * Math.PI) / 180);
const topRightPoint = { x: topX, y: topY, z: 0 };
const topLeftPoint = { x: -4, y: topY, z: 0 };
const bottomY = -2;
const bottomX =
  vertexPoint.x + Math.abs(bottomY) / Math.tan((45 * Math.PI) / 180);
const bottomLeftPoint = { x: bottomX, y: bottomY, z: 0 };
const bottomRightPoint = { x: 5, y: bottomY, z: 0 };
const helperLeftPoint = { x: -3, y: 0, z: 0 };
const helperRightPoint = { x: 3, y: 0, z: 0 };

const questionData = [
  {
    points: [topLeftPoint, topRightPoint],
    color: getColor("INDIGO"),
    smooth: false,
    showPoints: false,
    labels: [
      { text: "P", at: 0, offset: [0, 0.5, 0] },
      { text: "Q", at: 1, offset: [0, 0.5, 0] },
    ],
  },
  {
    points: [bottomLeftPoint, bottomRightPoint],
    color: getColor("INDIGO"),
    smooth: false,
    showPoints: false,
    labels: [
      { text: "R", at: 0, offset: [0, -0.5, 0] },
      { text: "S", at: 1, offset: [0, -0.5, 0] },
    ],
  },
  {
    points: [topRightPoint, vertexPoint, bottomLeftPoint],
    color: getColor("INDIGO"),
    smooth: false,
    showPoints: true,
    labels: [
      { text: "25°", at: 0, offset: [-2, -0.5, 0] },
      { text: "α", at: 1, offset: [-0.5, 0.5, 0] },
      { text: "135°", at: 2, offset: [1, 0.5, 0] },
    ],
  },
] satisfies ComponentProps<typeof LineEquation>["data"];

const answerSegments = [
  {
    points: [helperLeftPoint, vertexPoint, helperRightPoint],
    color: getColor("TEAL"),
    smooth: false,
    showPoints: false,
    labels: [
      { text: "β", at: 1, offset: [2, 0.5, 0] },
      { text: "γ", at: 1, offset: [2, -0.5, 0] },
    ],
  },
] satisfies ComponentProps<typeof LineEquation>["data"];

const answerData = [...questionData, ...answerSegments];

export function Graph({ title, description, mode = "question" }: GraphProps) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 10]}
      data={mode === "answer" ? answerData : questionData}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
