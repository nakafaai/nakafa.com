import { LineEquationCard } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualCardHeader } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps, ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  mode?: "question" | "answer";
  title: ReactNode;
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
    color: getColor("VIOLET"),
    lineWidth: 2,
    smooth: false,
    showPoints: true,
    labels: [
      { text: <InlineMath math="A" />, at: 0, offset: [-1, 1, 0] },
      { text: <InlineMath math="B" />, at: 1, offset: [1, 1, 0] },
      { text: <InlineMath math="C" />, at: 2, offset: [1, -1, 0] },
      { text: <InlineMath math="D" />, at: 3, offset: [-1, -1, 0] },
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
    smooth: false,
    showPoints: false,
  },
] satisfies ComponentProps<typeof LineEquationCard>["data"];

const answerSegments = [
  {
    points: [pointA, pointF, pointD],
    color: getColor("ORANGE"),
    smooth: false,
    showPoints: true,
    labels: [{ text: <InlineMath math="F" />, at: 1, offset: [0, -1, 0] }],
  },
  {
    points: [pointF, pointG],
    color: getColor("ORANGE"),
    smooth: false,
    showPoints: true,
    labels: [{ text: <InlineMath math="G" />, at: 1, offset: [1, 0.5, 0] }],
  },
  {
    points: [pointE, pointF],
    color: getColor("ORANGE"),
    smooth: false,
    showPoints: true,
    labels: [{ text: <InlineMath math="E" />, at: 0, offset: [-1, 0.5, 0] }],
  },
] satisfies ComponentProps<typeof LineEquationCard>["data"];

const answerData = [...questionData, ...answerSegments];

/** Renders the quantitative graph for SNBT set 9 question 2. */
export function Graph({ title, description, mode = "question" }: GraphProps) {
  return (
    <LineEquationCard
      cameraPosition={[0, 0, 15]}
      data={mode === "answer" ? answerData : questionData}
      header={<VisualCardHeader description={description} title={title} />}
    />
  );
}
