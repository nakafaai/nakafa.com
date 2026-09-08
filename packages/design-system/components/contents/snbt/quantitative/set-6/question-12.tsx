import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

// The outer base angles are 80 degrees; the inner base angles are 40 degrees.
const A = { x: 0, y: -5 + 2 * Math.tan((80 * Math.PI) / 180), z: 0 };
const B = { x: -2, y: -5, z: 0 };
const C = { x: 2, y: -5, z: 0 };
const D = { x: 0, y: -5 + 2 * Math.tan((40 * Math.PI) / 180), z: 0 };

/** Renders the quantitative graph for SNBT set 6 question 12. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Outer Triangle ABC
        {
          points: [A, B, C, A],
          color: getColor("INDIGO"),
          showPoints: true,
          smooth: false,
          labels: [
            {
              text: <InlineMath math="a^\circ" />,
              at: 0,
              offset: [0, -1.5, 0],
            },
            {
              text: <InlineMath math="x^\circ" />,
              at: 1,
              offset: [0.8, 1.2, 0],
            },
            {
              text: <InlineMath math="y^\circ" />,
              at: 1,
              offset: [1, 0.3, 0],
            },
            {
              text: <InlineMath math="y^\circ" />,
              at: 2,
              offset: [-0.8, 1.2, 0],
            },
            {
              text: <InlineMath math="x^\circ" />,
              at: 2,
              offset: [-1, 0.3, 0],
            },
          ],
        },
        // Inner Triangle Lines BD and CD
        {
          points: [B, D, C],
          color: getColor("TEAL"),
          showPoints: true,
          smooth: false,
          labels: [
            {
              text: <InlineMath math="100^\circ" />,
              at: 1,
              offset: [0, -0.8, 0],
            },
          ],
        },
      ]}
      description={description}
      title={title}
    />
  );
}
