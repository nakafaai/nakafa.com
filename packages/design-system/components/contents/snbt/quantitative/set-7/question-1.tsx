import { LineEquationProvider } from "@repo/design-system/components/contents/mathematics/line/context";
import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import type { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { resolveLineScene } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CoordinateControls } from "@repo/design-system/components/three/controls";
import {
  VisualCard,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

/** Renders the quantitative graph for SNBT set 7 question 1. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  const startY = -6;
  const endY = 4;
  const step = 0.05;
  const steps = Math.ceil((endY - startY) / step);

  // Parabola equation: x = a(y - k)^2 + h
  // Vertex (h, k) = (64/15, -1) -> (4.266..., -1)
  // Passes through (4, 0) and (0, 3)
  // Equation: x = -4/15 * (y + 1)^2 + 64/15
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const y = startY + i * step;
    // x = -4/15 * (y + 1)^2 + 64/15
    const x = (-4 / 15) * (y + 1) ** 2 + 64 / 15;
    return { x, y, z: 0 };
  });

  // Calculate indices for labels
  const indexY3 = Math.round((3 - startY) / step);
  const indexY0 = Math.round((0 - startY) / step);
  const indexYMin5 = Math.round((-5 - startY) / step);

  const config = resolveLineScene({
    cameraPosition: [1, -1, 14],
    cameraTarget: [1, -1, 0],
    data: [
      {
        points,
        color: getColor("INDIGO"),
        lineWidth: 3,
        showPoints: false,
        smooth: false,
        cone: { position: "both", size: 0.5 },
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
    ],
    showZAxis: false,
  });

  return (
    <LineEquationProvider config={config}>
      <VisualCard>
        <VisualCardHeader description={description} title={title} />
        <DeferredLineScene />
        <CoordinateControls />
      </VisualCard>
    </LineEquationProvider>
  );
}
