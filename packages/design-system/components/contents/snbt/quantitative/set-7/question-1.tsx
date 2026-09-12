import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

/** Renders the quantitative graph for SNBT set 7 question 1. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  // Constants for calculation
  const Y_START = -10;
  const Y_END = 8;
  const STEP = 0.05;
  const NUM_STEPS = Math.ceil((Y_END - Y_START) / STEP);

  // Parabola equation: x = a(y - k)^2 + h
  // Vertex (h, k) = (64/15, -1) -> (4.266..., -1)
  // Passes through (4, 0) and (0, 3)
  // Equation: x = -4/15 * (y + 1)^2 + 64/15
  const points = Array.from({ length: NUM_STEPS + 1 }, (_, i) => {
    const y = Y_START + i * STEP;
    // x = -4/15 * (y + 1)^2 + 64/15
    const x = (-4 / 15) * (y + 1) ** 2 + 64 / 15;
    return { x, y, z: 0 };
  });

  // Calculate indices for labels
  const indexY3 = Math.round((3 - Y_START) / STEP);
  const indexY0 = Math.round((0 - Y_START) / STEP);
  const indexYMin5 = Math.round((-5 - Y_START) / STEP);

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        {
          points,
          color: getColor("INDIGO"),
          lineWidth: 3,
          showPoints: false,
          labels: [
            {
              text: <InlineMath math="3" />,
              at: indexY3,
              offset: [0.5, 0.5, 0], // Slightly right
            },
            {
              text: <InlineMath math="4" />,
              at: indexY0,
              offset: [0.5, 0.5, 0], // Above
            },
            {
              text: <InlineMath math="-5" />,
              at: indexYMin5,
              offset: [0.5, -0.5, 0], // Slightly right
            },
          ],
        },
      ]}
      description={description}
      title={title}
    />
  );
}
