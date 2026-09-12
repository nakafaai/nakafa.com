import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

const f_points = [-24, -0.5, 0, 5, 24].map((x) => ({ x, y: 5 - x, z: 0 }));

const g_points = Array.from({ length: 1281 }, (_, i) => {
  const x = -24 + i * 0.025;
  return { x, y: 2 ** x - 1, z: 0 };
});

/** Renders the quantitative graph for SNBT set 7 question 14. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        {
          points: f_points,
          color: getColor("INDIGO"),
          labels: [
            {
              text: <InlineMath math="y = f(x)" />,
              at: 1,
              offset: [0, -2, 0],
            },
            {
              text: <InlineMath math="5" />,
              at: f_points.findIndex((p) => p.x === 0),
              offset: [-0.5, 0, 0],
            },
            {
              text: <InlineMath math="5" />,
              at: f_points.findIndex((p) => p.x === 5),
              offset: [0.5, 0.5, 0],
            },
          ],
          showPoints: false,
          smooth: false,
        },
        {
          points: g_points,
          color: getColor("TEAL"),
          labels: [
            {
              text: <InlineMath math="y = g(x)" />,
              at: g_points.findIndex((p) => p.x === 2),
              offset: [2, 1, 0],
            },
            {
              text: <InlineMath math="(2, 3)" />,
              at: g_points.findIndex((p) => p.x === 2),
              offset: [1, -0.5, 0],
            },
          ],
          showPoints: false,
          smooth: false,
        },
      ]}
      description={description}
      title={title}
    />
  );
}
