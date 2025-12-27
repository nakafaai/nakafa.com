import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

interface GraphProps
  extends Pick<ComponentProps<typeof LineEquation>, "title" | "description"> {
  mode?: "question" | "answer";
}

export function Graph({ title, description, mode = "question" }: GraphProps) {
  // Coordinates scaled to 1/3 for better readability
  const A = { x: -4, y: 4, z: 0 };
  const B = { x: 4, y: 4, z: 0 };
  const C = { x: 4, y: -4, z: 0 };
  const D = { x: -4, y: -4, z: 0 };
  const E = { x: -4, y: 0, z: 0 };
  const F = { x: -1, y: 0, z: 0 };
  const G = { x: 4, y: 0, z: 0 };

  const commonData: ComponentProps<typeof LineEquation>["data"] = [
    {
      points: [A, B, C, D, A],
      color: getColor("BLUE"),
      lineWidth: 2,
      smooth: false,
      showPoints: true,
      labels: [
        { text: "A", at: 0, offset: [-1, 1, 0] },
        { text: "B", at: 1, offset: [1, 1, 0] },
        { text: "C", at: 2, offset: [1, -1, 0] },
        { text: "D", at: 3, offset: [-1, -1, 0] },
      ],
    },
    {
      points: Array.from({ length: 65 }, (_, i) => ({
        x: -1 + 5 * Math.cos((i / 64) * Math.PI * 2),
        y: 5 * Math.sin((i / 64) * Math.PI * 2),
        z: 0,
      })),
      color: getColor("EMERALD"),
      lineWidth: 2,
      smooth: true,
      showPoints: false,
    },
  ];

  const answerData: ComponentProps<typeof LineEquation>["data"] = [
    {
      points: [A, F, D],
      color: getColor("ORANGE"),
      smooth: false,
      showPoints: true,
      labels: [{ text: "F", at: 1, offset: [0, -1, 0] }],
    },
    {
      points: [F, G],
      color: getColor("ORANGE"),
      smooth: false,
      showPoints: true,
      labels: [{ text: "G", at: 1, offset: [1, 0.5, 0] }],
    },
    {
      points: [E, F],
      color: getColor("ORANGE"),
      smooth: false,
      showPoints: true,
      labels: [{ text: "E", at: 0, offset: [-1, 0.5, 0] }],
    },
  ];

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={mode === "answer" ? [...commonData, ...answerData] : commonData}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
