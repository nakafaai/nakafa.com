import { LineEquationCard } from "@repo/design-system/components/contents/mathematics/line/equation";
import { LineReadouts } from "@repo/design-system/components/contents/mathematics/line/readouts";
import { getMidpoint } from "@repo/design-system/components/contents/snbt/geometry";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualCardHeader } from "@repo/design-system/components/visual/card";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type { ReactNode } from "react";

const cubeSize = 4;
const cubePointA = { x: cubeSize, y: 0, z: 0 };
const cubePointB = { x: cubeSize, y: cubeSize, z: 0 };
const cubePointC = { x: 0, y: cubeSize, z: 0 };
const cubePointD = { x: 0, y: 0, z: 0 };
const cubePointE = { x: cubeSize, y: 0, z: cubeSize };
const cubePointF = { x: cubeSize, y: cubeSize, z: cubeSize };
const cubePointG = { x: 0, y: cubeSize, z: cubeSize };
const cubePointH = { x: 0, y: 0, z: cubeSize };
const cubePointQ = {
  x: (cubePointF.x + cubePointG.x) / 2,
  y: (cubePointF.y + cubePointG.y) / 2,
  z: (cubePointF.z + cubePointG.z) / 2,
};
const cubePointO = { x: 3, y: 3, z: 0 };
const hiddenPoints = { showPoints: false };

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

/** Renders the coordinate graph for SNBT set 2 question 6. */
export function Graph({ description, title }: GraphProps) {
  return (
    <LineEquationCard
      cameraPosition={[8, -6, 9]}
      cameraTarget={[2, 2, 2]}
      data={[
        // Bottom Face
        {
          ...hiddenPoints,
          points: [cubePointD, getMidpoint(cubePointD, cubePointA), cubePointA],
          color: PLOT_COLORS.fuchsia,
          labels: [
            { text: <InlineMath math="D" />, at: 0, offset: [-0.3, -0.3, 0] },
            { text: <InlineMath math="A" />, at: 2, offset: [0.3, -0.3, 0] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointA, getMidpoint(cubePointA, cubePointB), cubePointB],
          color: PLOT_COLORS.fuchsia,
        },
        {
          ...hiddenPoints,
          points: [cubePointB, getMidpoint(cubePointB, cubePointC), cubePointC],
          color: PLOT_COLORS.fuchsia,
          labels: [
            { text: <InlineMath math="B" />, at: 0, offset: [0.3, 0.3, 0] },
            { text: <InlineMath math="C" />, at: 2, offset: [-0.3, 0.3, 0] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointC, getMidpoint(cubePointC, cubePointD), cubePointD],
          color: PLOT_COLORS.fuchsia,
        },

        // Top Face
        {
          ...hiddenPoints,
          points: [cubePointH, getMidpoint(cubePointH, cubePointE), cubePointE],
          color: PLOT_COLORS.fuchsia,
          labels: [
            { text: <InlineMath math="H" />, at: 0, offset: [-0.3, -0.3, 0.3] },
            { text: <InlineMath math="E" />, at: 2, offset: [0.9, -0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointE, getMidpoint(cubePointE, cubePointF), cubePointF],
          color: PLOT_COLORS.fuchsia,
        },
        {
          ...hiddenPoints,
          points: [cubePointF, getMidpoint(cubePointF, cubePointQ), cubePointQ],
          color: PLOT_COLORS.fuchsia,
          labels: [
            { text: <InlineMath math="F" />, at: 0, offset: [0.3, 0.3, 0.3] },
            { text: <InlineMath math="2" />, at: 1, offset: [0, 0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointQ, getMidpoint(cubePointQ, cubePointG), cubePointG],
          color: PLOT_COLORS.fuchsia,
          labels: [
            { text: <InlineMath math="2" />, at: 1, offset: [0, 0.3, 0.3] },
            { text: <InlineMath math="G" />, at: 2, offset: [-0.3, 0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointG, getMidpoint(cubePointG, cubePointH), cubePointH],
          color: PLOT_COLORS.fuchsia,
        },

        // Vertical Edges
        {
          ...hiddenPoints,
          points: [cubePointD, getMidpoint(cubePointD, cubePointH), cubePointH],
          color: PLOT_COLORS.fuchsia,
          labels: [
            { text: <InlineMath math="4" />, at: 1, offset: [-0.3, -0.3, 0] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointA, getMidpoint(cubePointA, cubePointE), cubePointE],
          color: PLOT_COLORS.fuchsia,
        },
        {
          ...hiddenPoints,
          points: [cubePointB, getMidpoint(cubePointB, cubePointF), cubePointF],
          color: PLOT_COLORS.fuchsia,
          labels: [
            { text: <InlineMath math="4" />, at: 1, offset: [0.9, 0.1, -0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointC, getMidpoint(cubePointC, cubePointG), cubePointG],
          color: PLOT_COLORS.fuchsia,
        },

        // Diagonal BD
        {
          ...hiddenPoints,
          points: [cubePointB, cubePointD],
          color: PLOT_COLORS.orange,
        },

        // Triangle DBQ Lines
        {
          ...hiddenPoints,
          points: [cubePointD, getMidpoint(cubePointD, cubePointQ), cubePointQ],
          color: PLOT_COLORS.teal,
          labels: [
            { text: <InlineMath math="6" />, at: 1, offset: [-0.3, 0.3, 0] },
            { text: <InlineMath math="Q" />, at: 2, offset: [0, 0.3, 0.3] },
          ],
        },
        {
          ...hiddenPoints,
          points: [cubePointB, getMidpoint(cubePointB, cubePointQ), cubePointQ],
          color: PLOT_COLORS.teal,
          labels: [
            {
              text: <InlineMath math="2\sqrt{5}" />,
              at: 1,
              offset: [0.3, 0, 0],
            },
          ],
        },

        // Line HQ (from image)
        {
          ...hiddenPoints,
          points: [cubePointH, getMidpoint(cubePointH, cubePointQ), cubePointQ],
          color: PLOT_COLORS.violet,
          labels: [
            {
              text: <InlineMath math="2\sqrt{5}" />,
              at: 1,
              offset: [0, 0, 0.3],
            },
          ],
        },

        // Height Line QO
        {
          ...hiddenPoints,
          points: [cubePointQ, getMidpoint(cubePointQ, cubePointO), cubePointO],
          color: PLOT_COLORS.pink,
          labels: [
            { text: <InlineMath math="y" />, at: 1, offset: [-0.4, -0.1, 0.1] },
            { text: <InlineMath math="O" />, at: 2, offset: [0.2, 0.2, 0] },
          ],
        },
      ]}
      facts={<LineReadouts />}
      header={<VisualCardHeader description={description} title={title} />}
    />
  );
}
