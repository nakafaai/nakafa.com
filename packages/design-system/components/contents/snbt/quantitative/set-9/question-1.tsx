import { LineEquationProvider } from "@repo/design-system/components/contents/mathematics/line/context";
import { DeferredLineScene } from "@repo/design-system/components/contents/mathematics/line/deferred";
import type { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { resolveLineScene } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { CoordinateControls } from "@repo/design-system/components/three/controls";
import {
  VisualCard,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps } from "react";

type GraphProps = Pick<
  ComponentProps<typeof LineEquation>,
  "title" | "description"
>;

/** Renders the quantitative graph for SNBT set 9 question 1. */
export function Graph({ title, description }: GraphProps) {
  const radius = 8;
  const largeSquareHalf = 8;

  const largeSquarePoints = [
    { x: largeSquareHalf, y: largeSquareHalf, z: 0 },
    { x: -largeSquareHalf, y: largeSquareHalf, z: 0 },
    { x: -largeSquareHalf, y: -largeSquareHalf, z: 0 },
    { x: largeSquareHalf, y: -largeSquareHalf, z: 0 },
    { x: largeSquareHalf, y: largeSquareHalf, z: 0 },
  ];

  const circlePoints = Array.from({ length: 65 }, (_, i) => {
    const angle = (i / 64) * Math.PI * 2;
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: 0,
    };
  });

  const smallSquarePoints = Array.from({ length: 5 }, (_, i) => {
    const angle = Math.PI / 4 + (i * Math.PI) / 2;
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: 0,
    };
  });

  const data = [
    {
      points: largeSquarePoints,
      color: getColor("VIOLET"),
      lineWidth: 2,
      smooth: false,
      showPoints: false,
    },
    {
      points: circlePoints,
      color: getColor("EMERALD"),
      lineWidth: 2,
      smooth: false,
      showPoints: false,
    },
    {
      points: smallSquarePoints,
      color: getColor("ORANGE"),
      lineWidth: 2,
      smooth: false,
      showPoints: false,
    },
  ];

  const config = resolveLineScene({
    cameraPosition: [0, 0, 20],
    data,
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
