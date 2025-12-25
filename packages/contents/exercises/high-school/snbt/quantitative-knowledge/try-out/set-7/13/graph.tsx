import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps, ReactNode } from "react";

interface Props {
  title: ReactNode;
  description: ReactNode;
}

export function Graph({ title, description }: Props) {
  // Define points (shifted y by -2 to center the triangle vertically)
  const A = { x: -3, y: -2, z: 0 };
  const B = { x: 3, y: -2, z: 0 };
  const C = { x: 0, y: 2, z: 0 };
  const P = { x: 0, y: -2, z: 0 };
  const R = { x: -1.5, y: 0, z: 0 };
  const Q = { x: 1.5, y: 0, z: 0 };

  const data: ComponentProps<typeof LineEquation>["data"] = [
    // Triangle ABC
    {
      points: [A, B, C, A],
      color: getColor("INDIGO"),
      showPoints: true,
      smooth: false,
      labels: [
        {
          text: "A",
          at: 0,
          offset: [-0.5, -0.5, 0],
          color: getColor("INDIGO"),
        },
        { text: "B", at: 1, offset: [0.5, -0.5, 0], color: getColor("INDIGO") },
        { text: "C", at: 2, offset: [0, 0.5, 0], color: getColor("INDIGO") },
      ],
    },
    // Line CP
    {
      points: [C, P],
      color: getColor("TEAL"),
      showPoints: true,
      smooth: false,
      labels: [
        { text: "P", at: 1, offset: [0, -0.5, 0], color: getColor("TEAL") },
      ],
    },
    // Line AQ
    {
      points: [A, Q],
      color: getColor("VIOLET"),
      showPoints: true,
      smooth: false,
      labels: [
        { text: "Q", at: 1, offset: [0.3, 0.3, 0], color: getColor("VIOLET") },
      ],
    },
    // Line BR
    {
      points: [B, R],
      color: getColor("VIOLET"),
      showPoints: true,
      smooth: false,
      labels: [
        { text: "R", at: 1, offset: [-0.3, 0.3, 0], color: getColor("VIOLET") },
      ],
    },
  ];

  return (
    <LineEquation
      cameraPosition={[0, 0, 10]}
      data={data}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
