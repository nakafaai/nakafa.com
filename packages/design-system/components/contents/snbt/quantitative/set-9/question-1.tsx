import { LineEquationCard } from "@repo/design-system/components/contents/mathematics/line/equation";
import { LineReadouts } from "@repo/design-system/components/contents/mathematics/line/readouts";
import { VisualCardHeader } from "@repo/design-system/components/visual/card";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

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
      color: PLOT_COLORS.violet,
      lineWidth: 2,
      smooth: false,
      showPoints: false,
    },
    {
      points: circlePoints,
      color: PLOT_COLORS.teal,
      lineWidth: 2,
      smooth: false,
      showPoints: false,
    },
    {
      points: smallSquarePoints,
      color: PLOT_COLORS.orange,
      lineWidth: 2,
      smooth: false,
      showPoints: false,
    },
  ];

  return (
    <LineEquationCard
      cameraPosition={[0, 0, 20]}
      data={data}
      facts={<LineReadouts />}
      header={<VisualCardHeader description={description} title={title} />}
    />
  );
}
