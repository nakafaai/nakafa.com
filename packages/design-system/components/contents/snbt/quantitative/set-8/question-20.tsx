import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

/** Renders the quantitative graph for SNBT set 8 question 20. */
export function Graph({
  title,
  description,
}: Pick<ComponentProps<typeof LineEquation>, "title" | "description">) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Triangle Q (Left)
        // Left side: (-8, -2) to (-5, 3)
        {
          points: [
            { x: -8, y: -2, z: 0 },
            { x: -6.5, y: 0.5, z: 0 },
            { x: -5, y: 3, z: 0 },
          ],
          color: getColor("INDIGO"),
          labels: [
            {
              text: <InlineMath math="22" />,
              at: 1,
              offset: [-1, 0, 0],
              color: getColor("INDIGO"),
            },
          ],
          showPoints: false,
        },
        // Right side: (-5, 3) to (-2, -2)
        {
          points: [
            { x: -5, y: 3, z: 0 },
            { x: -3.5, y: 0.5, z: 0 },
            { x: -2, y: -2, z: 0 },
          ],
          color: getColor("INDIGO"),
          labels: [
            {
              text: <InlineMath math="20" />,
              at: 1,
              offset: [1, 0, 0],
              color: getColor("INDIGO"),
            },
          ],
          showPoints: false,
        },
        // Bottom side: (-2, -2) to (-8, -2)
        {
          points: [
            { x: -2, y: -2, z: 0 },
            { x: -5, y: -2, z: 0 },
            { x: -8, y: -2, z: 0 },
          ],
          color: getColor("INDIGO"),
          labels: [
            {
              text: <InlineMath math="2" />,
              at: 1,
              offset: [0, -1, 0],
              color: getColor("INDIGO"),
            },
            {
              text: <InlineMath math="4" />,
              at: 1,
              offset: [0, 1.5, 0],
              color: getColor("INDIGO"),
            }, // Center label
          ],
          showPoints: false,
        },
        // Label Q
        {
          points: [
            { x: -5, y: 4, z: 0 },
            { x: -5, y: 4, z: 0 },
          ], // Point above top
          color: "transparent",
          labels: [
            { text: <InlineMath math="Q" />, at: 0, color: getColor("INDIGO") },
          ],
          showPoints: false,
        },

        // Triangle R (Right)
        // Left side: (2, -2) to (5, 3)
        {
          points: [
            { x: 2, y: -2, z: 0 },
            { x: 3.5, y: 0.5, z: 0 },
            { x: 5, y: 3, z: 0 },
          ],
          color: getColor("TEAL"),
          labels: [
            {
              text: <InlineMath math="13" />,
              at: 1,
              offset: [-1, 0, 0],
              color: getColor("TEAL"),
            },
          ],
          showPoints: false,
        },
        // Right side: (5, 3) to (8, -2)
        {
          points: [
            { x: 5, y: 3, z: 0 },
            { x: 6.5, y: 0.5, z: 0 },
            { x: 8, y: -2, z: 0 },
          ],
          color: getColor("TEAL"),
          labels: [
            {
              text: <InlineMath math="12" />,
              at: 1,
              offset: [1, 0, 0],
              color: getColor("TEAL"),
            },
          ],
          showPoints: false,
        },
        // Bottom side: (8, -2) to (2, -2)
        {
          points: [
            { x: 8, y: -2, z: 0 },
            { x: 5, y: -2, z: 0 },
            { x: 2, y: -2, z: 0 },
          ],
          color: getColor("TEAL"),
          labels: [
            {
              text: <InlineMath math="3" />,
              at: 1,
              offset: [0, -1, 0],
              color: getColor("TEAL"),
            },
            {
              text: <InlineMath math="?" />,
              at: 1,
              offset: [0, 1.5, 0],
              color: getColor("TEAL"),
            }, // Center label
          ],
          showPoints: false,
        },
        // Label R
        {
          points: [
            { x: 5, y: 4, z: 0 },
            { x: 5, y: 4, z: 0 },
          ], // Point above top
          color: "transparent",
          labels: [
            { text: <InlineMath math="R" />, at: 0, color: getColor("TEAL") },
          ],
          showPoints: false,
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
