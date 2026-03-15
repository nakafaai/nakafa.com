import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

export function QuestionGraph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  // Configuration
  const step = 0.1;
  const startY = -2.5; // Slightly beyond -2
  const endY = 4.5; // Slightly beyond 4

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
      cameraPosition={[0, 0, 15]}
      data={[
        {
          points,
          color: getColor("INDIGO"),
          showPoints: false,
          labels: [
            { text: "4", at: index4, offset: [-0.5, -0.5, 0] },
            { text: "-2", at: indexNeg2, offset: [-0.6, 0.5, 0] },
            { text: "8", at: index8, offset: [0.3, -0.5, 0] },
          ],
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
