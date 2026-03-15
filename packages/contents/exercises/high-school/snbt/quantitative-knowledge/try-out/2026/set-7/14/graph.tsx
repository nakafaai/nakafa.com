import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

const f_points = Array.from({ length: 20 }, (_, i) => {
  const x = -2 + i * 0.5;
  return { x, y: 5 - x, z: 0 };
});

const g_points = Array.from({ length: 60 }, (_, i) => {
  const x = -2 + i * 0.1;
  return { x, y: 2 ** x - 1, z: 0 };
});

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
              text: "y = f(x)",
              at: 3,
              offset: [0, -2, 0],
            },
            {
              text: "5",
              at: f_points.findIndex((p) => Math.abs(p.x) < 0.1),
              offset: [-0.5, 0, 0],
            },
            {
              text: "5",
              at: f_points.findIndex((p) => Math.abs(p.x - 5) < 0.1),
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
              text: "y = g(x)",
              at: g_points.length / 1.5,
              offset: [2, 1, 0],
            },
            {
              text: "(2, 3)",
              at: g_points.findIndex((p) => Math.abs(p.x - 2) < 0.1),
              offset: [1, -0.5, 0],
            },
          ],
          showPoints: false,
          smooth: true,
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
