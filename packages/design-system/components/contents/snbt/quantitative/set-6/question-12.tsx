import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

const A = { x: 0, y: 5, z: 0 };
const B = { x: -4, y: -5, z: 0 };
const C = { x: 4, y: -5, z: 0 };
const D = { x: 0, y: -2, z: 0 };

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
              color: getColor("INDIGO"),
            },
            {
              text: <InlineMath math="x^\circ" />,
              at: 1,
              offset: [0.8, 1.2, 0],
              color: getColor("INDIGO"),
            },
            {
              text: <InlineMath math="y^\circ" />,
              at: 1,
              offset: [1, 0.3, 0],
              color: getColor("INDIGO"),
            },
            {
              text: <InlineMath math="y^\circ" />,
              at: 2,
              offset: [-0.8, 1.2, 0],
              color: getColor("INDIGO"),
            },
            {
              text: <InlineMath math="x^\circ" />,
              at: 2,
              offset: [-1, 0.3, 0],
              color: getColor("INDIGO"),
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
              color: getColor("TEAL"),
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
