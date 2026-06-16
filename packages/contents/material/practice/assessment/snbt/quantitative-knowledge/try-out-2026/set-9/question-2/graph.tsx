import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

interface GraphProps
  extends Pick<ComponentProps<typeof LineEquation>, "title" | "description"> {
  mode?: "question" | "answer";
}

// Coordinates are scaled to one-third of the source diagram for readability.
const pointA = { x: -4, y: 4, z: 0 };
const pointB = { x: 4, y: 4, z: 0 };
const pointC = { x: 4, y: -4, z: 0 };
const pointD = { x: -4, y: -4, z: 0 };
const pointE = { x: -4, y: 0, z: 0 };
const pointF = { x: -1, y: 0, z: 0 };
const pointG = { x: 4, y: 0, z: 0 };

const questionData = [
  {
    points: [pointA, pointB, pointC, pointD, pointA],
    color: getColor("BLUE"),
    lineWidth: 2,
    smooth: false,
    showPoints: true,
    labels: [
      { text: "A", at: 0, offset: [-1, 1, 0] },
      { text: "B", at: 1, offset: [1, 1, 0] },
      { text: "C", at: 2, offset: [1, -1, 0] },
      { text: "D", at: 3, offset: [-1, -1, 0] },
    ],
  },
  {
    points: Array.from({ length: 65 }, (_, i) => ({
      x: -1 + 5 * Math.cos((i / 64) * Math.PI * 2),
      y: 5 * Math.sin((i / 64) * Math.PI * 2),
      z: 0,
    })),
    color: getColor("EMERALD"),
    lineWidth: 2,
    smooth: true,
    showPoints: false,
  },
] satisfies ComponentProps<typeof LineEquation>["data"];

const answerSegments = [
  {
    points: [pointA, pointF, pointD],
    color: getColor("ORANGE"),
    smooth: false,
    showPoints: true,
    labels: [{ text: "F", at: 1, offset: [0, -1, 0] }],
  },
  {
    points: [pointF, pointG],
    color: getColor("ORANGE"),
    smooth: false,
    showPoints: true,
    labels: [{ text: "G", at: 1, offset: [1, 0.5, 0] }],
  },
  {
    points: [pointE, pointF],
    color: getColor("ORANGE"),
    smooth: false,
    showPoints: true,
    labels: [{ text: "E", at: 0, offset: [-1, 0.5, 0] }],
  },
] satisfies ComponentProps<typeof LineEquation>["data"];

const answerData = [...questionData, ...answerSegments];

export function Graph({ title, description, mode = "question" }: GraphProps) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={mode === "answer" ? answerData : questionData}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
