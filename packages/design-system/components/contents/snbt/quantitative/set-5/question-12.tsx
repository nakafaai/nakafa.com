import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

/** Renders the quantitative graph for SNBT set 5 question 12. */
export function QuestionGraph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  // Configuration
  const step = 0.05;
  const startY = -8;
  const endY = 10;

  // Function: x = -y^2 + 2y + 8
  const points = Array.from({
    length: Math.floor((endY - startY) / step) + 1,
  }).map((_, i) => {
    const y = startY + i * step;
    const x = -(y ** 2) + 2 * y + 8;
    return { x, y, z: 0 };
  });

  // Calculate indices for labels
  // y = 4 (x=0)
  const index4 = Math.round((4 - startY) / step);
  // y = -2 (x=0)
  const indexNeg2 = Math.round((-2 - startY) / step);
  // x = 8 (y=0, vertex at y=1 is x=9, so y=0 is x=8)
  const index8 = Math.round((0 - startY) / step);

  return (
    <LineEquation
      cameraPosition={[3, 1, 18]}
      cameraTarget={[3, 1, 0]}
      data={[
        {
          points,
          color: getColor("INDIGO"),
          showPoints: false,
          labels: [
            {
              text: <InlineMath math="4" />,
              at: index4,
              offset: [-0.5, -0.5, 0],
            },
            {
              text: <InlineMath math="-2" />,
              at: indexNeg2,
              offset: [-0.6, 0.5, 0],
            },
            {
              text: <InlineMath math="8" />,
              at: index8,
              offset: [0.3, -0.5, 0],
            },
          ],
        },
      ]}
      description={description}
      title={title}
    />
  );
}
