import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

const linearPoints = [-1, -0.5, 0, 5, 6].map((x) => ({ x, y: 5 - x, z: 0 }));

const exponentialPoints = Array.from({ length: 181 }, (_, i) => {
  const x = -1 + i * 0.025;
  return { x, y: 2 ** x - 1, z: 0 };
});

/** Renders the quantitative graph for SNBT set 7 question 14. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  return (
    <LineEquation
      cameraPosition={[2.5, 3, 12]}
      cameraTarget={[2.5, 3, 0]}
      data={[
        {
          points: linearPoints,
          color: getColor("INDIGO"),
          labels: [
            {
              text: <InlineMath math="y = f(x)" />,
              at: 1,
              offset: [-1.4, -2, 0],
            },
            {
              text: <InlineMath math="5" />,
              at: linearPoints.findIndex((p) => p.x === 0),
              offset: [-0.5, 0, 0],
            },
            {
              text: <InlineMath math="5" />,
              at: linearPoints.findIndex((p) => p.x === 5),
              offset: [0.5, 0.5, 0],
            },
          ],
          showPoints: false,
          smooth: false,
          cone: { position: "both", size: 0.5 },
        },
        {
          points: exponentialPoints,
          color: getColor("TEAL"),
          labels: [
            {
              text: <InlineMath math="y = g(x)" />,
              at: exponentialPoints.findIndex((p) => p.x === 2),
              offset: [2, 1, 0],
            },
            {
              text: <InlineMath math="(2, 3)" />,
              at: exponentialPoints.findIndex((p) => p.x === 2),
              offset: [2, 0, 0],
            },
          ],
          showPoints: false,
          smooth: false,
          cone: { position: "both", size: 0.5 },
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
