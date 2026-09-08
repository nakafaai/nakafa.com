import { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

/** Renders the quantitative graph for SNBT set 6 question 19. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  // Solves (1/2)^x - 3 = 2x + 6 and is included in the sampled curve.
  const intersectionX = -2.201_003_972_920_786_6;
  const intersectionIndex = Math.round(((intersectionX + 4) * 49) / 6);
  // Generate points for linear function: y = 2x + 6
  // Range x: -4 to 2
  const linearPoints = Array.from({ length: 50 }).map((_, i) => {
    const x = -4 + (i * 6) / 49;
    return { x, y: 2 * x + 6, z: 0 };
  });

  // Generate points for exponential function: y = (1/2)^x - 3
  // Range x: -4 to 2
  const exponentialPoints = Array.from({ length: 50 }).map((_, i) => {
    const x = i === intersectionIndex ? intersectionX : -4 + (i * 6) / 49;
    return { x, y: 0.5 ** x - 3, z: 0 };
  });

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Linear Line: y = 2x + 6
        {
          points: linearPoints,
          color: getColor("INDIGO"),
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: <InlineMath math="y = 2x + 6" />,
              at: 25,
              offset: [3, 0.5, 0],
            },
          ],
        },
        // Exponential Curve: y = (1/2)^x - 3
        {
          points: exponentialPoints,
          color: getColor("ORANGE"),
          showPoints: false,
          smooth: false,
          labels: [
            {
              text: <InlineMath math="y = \left(\frac{1}{2}\right)^x - 3" />,
              at: 45,
              offset: [1, 2, 0],
            },
          ],
        },
        // Point A (0, -2) - y-intercept of curve
        {
          points: [{ x: 0, y: -2, z: 0 }],
          color: getColor("ORANGE"),
          showPoints: true,
          labels: [{ text: <InlineMath math="A" />, offset: [0.5, 0, 0] }],
        },
        // Point B (0, 6) - y-intercept of line
        {
          points: [{ x: 0, y: 6, z: 0 }],
          color: getColor("INDIGO"),
          showPoints: true,
          labels: [{ text: <InlineMath math="B" />, offset: [0.5, 0, 0] }],
        },
        // Point C (-3, 0) - x-intercept of line
        {
          points: [{ x: -3, y: 0, z: 0 }],
          color: getColor("INDIGO"),
          showPoints: true,
          labels: [{ text: <InlineMath math="C" />, offset: [0, -0.5, 0] }],
        },
        // Point D is the shared point of the line and the exponential curve.
        {
          points: [{ x: intersectionX, y: 2 * intersectionX + 6, z: 0 }],
          color: getColor("TEAL"),
          showPoints: true,
          labels: [{ text: <InlineMath math="D" />, offset: [0.4, 0.4, 0] }],
        },
      ]}
      description={description}
      title={title}
    />
  );
}
