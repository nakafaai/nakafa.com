import { LineSceneCard } from "@repo/design-system/components/contents/mathematics/line/card";
import { LineEquationProvider } from "@repo/design-system/components/contents/mathematics/line/context";
import type { LineEquation } from "@repo/design-system/components/contents/mathematics/line/equation";
import { resolveLineScene } from "@repo/design-system/components/contents/mathematics/line/resolve";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualCardHeader } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import type { ComponentProps, ReactNode } from "react";

interface Props {
  description: ReactNode;
  title: ReactNode;
}

// Points are shifted down so the triangle sits near the visual center.
const pointA = { x: -3, y: -2, z: 0 };
const pointB = { x: 3, y: -2, z: 0 };
const pointC = { x: 0, y: 2, z: 0 };
const pointP = { x: 0, y: -2, z: 0 };
const pointR = { x: -1.5, y: 0, z: 0 };
const pointQ = { x: 1.5, y: 0, z: 0 };

const graphData = [
  {
    points: [pointA, pointB, pointC, pointA],
    color: getColor("INDIGO"),
    showPoints: true,
    smooth: false,
    labels: [
      {
        text: <InlineMath math="A" />,
        at: 0,
        offset: [-0.5, -0.5, 0],
      },
      {
        text: <InlineMath math="B" />,
        at: 1,
        offset: [0.5, -0.5, 0],
      },
      {
        text: <InlineMath math="C" />,
        at: 2,
        offset: [0, 0.5, 0],
      },
    ],
  },
  {
    points: [pointC, pointP],
    color: getColor("TEAL"),
    showPoints: true,
    smooth: false,
    labels: [
      {
        text: <InlineMath math="P" />,
        at: 1,
        offset: [0, -0.5, 0],
      },
    ],
  },
  {
    points: [pointA, pointQ],
    color: getColor("VIOLET"),
    showPoints: true,
    smooth: false,
    labels: [
      {
        text: <InlineMath math="Q" />,
        at: 1,
        offset: [0.3, 0.3, 0],
      },
    ],
  },
  {
    points: [pointB, pointR],
    color: getColor("VIOLET"),
    showPoints: true,
    smooth: false,
    labels: [
      {
        text: <InlineMath math="R" />,
        at: 1,
        offset: [-0.3, 0.3, 0],
      },
    ],
  },
] satisfies ComponentProps<typeof LineEquation>["data"];

/** Renders the quantitative graph for SNBT set 7 question 13. */
export function Graph({ title, description }: Props) {
  const config = resolveLineScene({
    cameraPosition: [0, 0, 10],
    data: graphData,
  });

  return (
    <LineEquationProvider config={config}>
      <LineSceneCard>
        <VisualCardHeader description={description} title={title} />
      </LineSceneCard>
    </LineEquationProvider>
  );
}
