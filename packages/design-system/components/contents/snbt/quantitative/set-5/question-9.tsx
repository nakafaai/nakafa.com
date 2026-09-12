import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

/** Renders the quantitative graph for SNBT set 5 question 9. */
export function QuestionGraph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  const step = 0.025;
  const startExp = -24;
  const endExp = 8;
  const startLine = -24;
  const endLine = 24;
  // Solves 2^x + 2x - 6 = 0. Include D itself in the sampled curve.
  const intersectionX = 1.543_000_440_865_408_3;
  const indexD = Math.round((intersectionX - startExp) / step);

  // Function 1: y = 2^x - 2
  const expPoints = Array.from({
    length: Math.floor((endExp - startExp) / step) + 1,
  }).map((_, i) => {
    const x = i === indexD ? intersectionX : startExp + i * step;
    return { x, y: 2 ** x - 2, z: 0 };
  });

  // Function 2: y = -2x + 4
  const linePoints = [startLine, 2, 3.5, endLine].map((x) => ({
    x,
    y: -2 * x + 4,
    z: 0,
  }));

  // Calculate indices for labels
  // A: x = 0 on exp curve
  const indexA = Math.round((0 - startExp) / step);
  // B: x = 1 on exp curve
  const indexB = Math.round((1 - startExp) / step);
  // C: x = 2 on line curve
  const indexC = 1;

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        {
          points: expPoints,
          color: getColor("INDIGO"),
          showPoints: false,
          cone: { position: "end", size: 0.5 },
          labels: [
            {
              text: <InlineMath math="A" />,
              at: indexA,
              offset: [0.4, -0.4, 0],
            },
            {
              text: <InlineMath math="B" />,
              at: indexB,
              offset: [0.3, -0.4, 0],
            },
            {
              text: <InlineMath math="D" />,
              at: indexD,
              offset: [-0.6, 0.5, 0],
            },
            {
              text: <InlineMath math="y = 2^x - 2" />,
              at: Math.round((2.5 - startExp) / step),
              offset: [1, 0.5, 0],
            },
          ],
        },
        {
          points: linePoints,
          color: getColor("TEAL"),
          showPoints: false,
          cone: { position: "both", size: 0.5 }, // Lines usually extend both ways
          labels: [
            {
              text: <InlineMath math="C" />,
              at: indexC,
              offset: [0.6, 0.3, 0],
            },
            {
              text: <InlineMath math="y = -2x + 4" />,
              at: 2,
              offset: [1, -0.5, 0],
            },
          ],
        },
      ]}
      description={description}
      title={title}
    />
  );
}
