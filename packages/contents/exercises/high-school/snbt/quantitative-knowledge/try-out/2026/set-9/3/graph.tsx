import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

interface GraphProps
  extends Pick<ComponentProps<typeof LineEquation>, "title" | "description"> {
  mode?: "question" | "answer";
}

export function Graph({ title, description, mode = "question" }: GraphProps) {
  // Coordinates
  // Center vertex V
  const V = { x: -1, y: 0, z: 0 };

  // Top line y = 2
  // Angle 25 degrees with horizontal
  const topY = 2;
  const topX = V.x + topY / Math.tan((25 * Math.PI) / 180);
  const Q = { x: topX, y: topY, z: 0 }; // Vertex Q
  const P = { x: -4, y: topY, z: 0 }; // Far left point P

  // Bottom line y = -2
  // Angle 45 degrees with horizontal (since 135 is supplementary)
  const botY = -2;
  const botX = V.x + Math.abs(botY) / Math.tan((45 * Math.PI) / 180);
  const R = { x: botX, y: botY, z: 0 }; // Vertex R
  const S = { x: 5, y: botY, z: 0 }; // Far right point S

  // Helper line endpoints for answer mode
  const HelperL = { x: -3, y: 0, z: 0 };
  const HelperR = { x: 3, y: 0, z: 0 };

  const commonData: ComponentProps<typeof LineEquation>["data"] = [
    // Top Line PQ
    {
      points: [P, Q],
      color: getColor("INDIGO"),
      smooth: false,
      showPoints: false,
      labels: [
        { text: "P", at: 0, offset: [0, 0.5, 0] },
        { text: "Q", at: 1, offset: [0, 0.5, 0] },
      ],
    },
    // Bottom Line RS
    {
      points: [R, S],
      color: getColor("INDIGO"),
      smooth: false,
      showPoints: false,
      labels: [
        { text: "R", at: 0, offset: [0, -0.5, 0] },
        { text: "S", at: 1, offset: [0, -0.5, 0] },
      ],
    },
    // Zig-zag line Q -> V -> R
    {
      points: [Q, V, R],
      color: getColor("INDIGO"),
      smooth: false,
      showPoints: true,
      labels: [
        { text: "25°", at: 0, offset: [-2, -0.5, 0] }, // Near Q, inside angle
        { text: "α", at: 1, offset: [-0.5, 0.5, 0] }, // Near V, inside opening (Right)
        { text: "135°", at: 2, offset: [1, 0.5, 0] }, // Near R, inside obtuse angle
      ],
    },
  ];

  const answerData: ComponentProps<typeof LineEquation>["data"] = [
    // Helper line through V
    // We include V in the points so we can use integer 'at' for labels
    {
      points: [HelperL, V, HelperR],
      color: getColor("TEAL"),
      smooth: false,
      showPoints: false,
      labels: [
        { text: "β", at: 1, offset: [2, 0.5, 0] }, // Top angle at V
        { text: "γ", at: 1, offset: [2, -0.5, 0] }, // Bottom angle at V
      ],
    },
  ];

  return (
    <LineEquation
      cameraPosition={[0, 0, 10]}
      data={mode === "answer" ? [...commonData, ...answerData] : commonData}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
