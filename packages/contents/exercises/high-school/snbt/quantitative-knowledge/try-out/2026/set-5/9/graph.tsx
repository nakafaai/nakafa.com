import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

export function QuestionGraph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  // Configuration
  const step = 0.1;
  const startExp = -1.5;
  const endExp = 2.5;
  const startLine = -1;
  const endLine = 3.5;

  // Function 1: y = 2^x - 2
  const expPoints = Array.from({
    length: Math.floor((endExp - startExp) / step) + 1,
  }).map((_, i) => {
    const x = startExp + i * step;
    return { x, y: 2 ** x - 2, z: 0 };
  });

  // Function 2: y = -2x + 4
  const linePoints = Array.from({
    length: Math.floor((endLine - startLine) / step) + 1,
  }).map((_, i) => {
    const x = startLine + i * step;
    return { x, y: -2 * x + 4, z: 0 };
  });

  // Calculate indices for labels
  // A: x = 0 on exp curve
  const indexA = Math.round((0 - startExp) / step);
  // B: x = 1 on exp curve
  const indexB = Math.round((1 - startExp) / step);
  // C: x = 2 on line curve
  const indexC = Math.round((2 - startLine) / step);
  // D: Intersection. 2^x - 2 = -2x + 4 => 2^x + 2x - 6 = 0 => x approx 1.38
  // We place label D on the exponential curve near intersection
  const intersectionX = 1.38;
  const indexD = Math.round((intersectionX - startExp) / step);

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
            { text: "A", at: indexA, offset: [0.4, -0.4, 0] },
            { text: "B", at: indexB, offset: [0.3, -0.4, 0] },
            { text: "D", at: indexD, offset: [-0.2, 0.5, 0] },
            {
              text: "y = 2^x - 2",
              at: expPoints.length - 1,
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
            { text: "C", at: indexC, offset: [0.3, 0.3, 0] },
            {
              text: "y = -2x + 4",
              at: linePoints.length - 1,
              offset: [1, -0.5, 0],
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
