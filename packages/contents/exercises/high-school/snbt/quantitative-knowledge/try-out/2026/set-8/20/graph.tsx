import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

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
              text: "22",
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
            { text: "20", at: 1, offset: [1, 0, 0], color: getColor("INDIGO") },
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
            { text: "2", at: 1, offset: [0, -1, 0], color: getColor("INDIGO") },
            {
              text: "4",
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
          labels: [{ text: "Q", at: 0, color: getColor("INDIGO") }],
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
            { text: "13", at: 1, offset: [-1, 0, 0], color: getColor("TEAL") },
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
            { text: "12", at: 1, offset: [1, 0, 0], color: getColor("TEAL") },
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
            { text: "3", at: 1, offset: [0, -1, 0], color: getColor("TEAL") },
            { text: "?", at: 1, offset: [0, 1.5, 0], color: getColor("TEAL") }, // Center label
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
          labels: [{ text: "R", at: 0, color: getColor("TEAL") }],
          showPoints: false,
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
