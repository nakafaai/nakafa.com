import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  // Constants for calculation
  const Y_START = -6;
  const Y_END = 4.1; // Extended slightly to include 4
  const STEP = 0.1;
  const NUM_STEPS = Math.ceil((Y_END - Y_START) / STEP);

  // Parabola equation: x = a(y - k)^2 + h
  // Vertex (h, k) = (64/15, -1) -> (4.266..., -1)
  // Passes through (4, 0) and (0, 3)
  // Equation: x = -4/15 * (y + 1)^2 + 64/15
  const points = Array.from({ length: NUM_STEPS }, (_, i) => {
    const y = Y_START + i * STEP;
    // x = -4/15 * (y + 1)^2 + 64/15
    const x = (-4 / 15) * (y + 1) ** 2 + 64 / 15;
    return { x, y, z: 0 };
  });

  // Calculate indices for labels
  // y = 3 -> 3 = -6 + i * 0.1 -> i = 90
  const indexY3 = Math.round((3 - Y_START) / STEP);
  // y = 0 -> 0 = -6 + i * 0.1 -> i = 60
  const indexY0 = Math.round((0 - Y_START) / STEP);
  // y = -5 -> -5 = -6 + i * 0.1 -> i = 10
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
              text: "3",
              at: indexY3,
              offset: [0.5, 0.5, 0], // Slightly right
              color: getColor("INDIGO"),
            },
            {
              text: "4",
              at: indexY0,
              offset: [0.5, 0.5, 0], // Above
              color: getColor("INDIGO"),
            },
            {
              text: "-5",
              at: indexYMin5,
              offset: [0.5, -0.5, 0], // Slightly right
              color: getColor("INDIGO"),
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
