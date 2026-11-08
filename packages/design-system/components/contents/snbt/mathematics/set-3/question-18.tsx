import { LineEquationCard } from "@repo/design-system/components/contents/mathematics/line/equation";
import { LineReadouts } from "@repo/design-system/components/contents/mathematics/line/readouts";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { VisualCardHeader } from "@repo/design-system/components/visual/card";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  labels: {
    building: string;
    helicopter: string;
    observer: string;
  };
  title: ReactNode;
}

const origin = { x: 0, y: 0, z: 0 };

/** Renders the coordinate graph for SNBT set 3 question 18. */
export function Graph({ title, description, labels }: GraphProps) {
  const scale = 4;
  const buildingHeight = 16 / scale;
  const observationDistance = (16 * Math.sqrt(3)) / scale;
  const helicopterHeight = observationDistance * Math.tan(Math.PI / 4);
  const totalGround = 32 / scale;
  const shadowLength = totalGround - observationDistance;
  const observerHeight = 2 / scale;
  const groundPadding = totalGround * 0.1;
  const labelOffsetX = totalGround * 0.08;
  const labelOffsetY = buildingHeight * 0.5;
  const angleRadius30 = observationDistance * 0.25;
  const angleRadius45 = observationDistance * 0.35;
  const arcSegments = 40;
  const angle30 = (30 * Math.PI) / 180;
  const angle45 = (45 * Math.PI) / 180;
  const arc30Start = Math.PI - angle30;
  const arc45Start = Math.PI - angle45;
  const arcBase = Math.PI;

  const arc30Points = Array.from({ length: arcSegments + 1 }, (_, index) => {
    const t = index / arcSegments;
    const theta = arc30Start + (arcBase - arc30Start) * t;
    return {
      x: observationDistance + angleRadius30 * Math.cos(theta),
      y: angleRadius30 * Math.sin(theta),
      z: 0,
    };
  });

  const arc45Points = Array.from({ length: arcSegments + 1 }, (_, index) => {
    const t = index / arcSegments;
    const theta = arc45Start + (arcBase - arc45Start) * t;
    return {
      x: observationDistance + angleRadius45 * Math.cos(theta),
      y: angleRadius45 * Math.sin(theta),
      z: 0,
    };
  });

  const arc30LabelIndex = Math.floor(arcSegments * 0.5);
  const arc45LabelIndex = Math.floor(arcSegments * 0.5);

  const buildingTop = { x: 0, y: buildingHeight, z: 0 };
  const helicopter = { x: 0, y: helicopterHeight, z: 0 };
  const observationPoint = { x: observationDistance, y: 0, z: 0 };
  const observerPosition = { x: totalGround, y: 0, z: 0 };
  const groundStart = { x: -groundPadding, y: 0, z: 0 };
  const groundEnd = { x: totalGround + groundPadding, y: 0, z: 0 };
  const dimensionY = -labelOffsetY * 0.4;
  const dimensionY_X = -labelOffsetY * 0.8;

  return (
    <LineEquationCard
      cameraPosition={[3.8, 2.7, 12]}
      cameraTarget={[3.8, 2.7, 0]}
      data={[
        {
          points: [origin, buildingTop],
          color: PLOT_COLORS.fuchsia,
          showPoints: false,
          labels: [
            {
              text: <InlineMath math="16\,\text{m}" />,
              at: 1,
              offset: [-labelOffsetX, -labelOffsetY, 0],
            },
            {
              text: labels.building,
              at: 1,
              offset: [1.4, 0, 0],
            },
          ],
        },
        {
          points: [buildingTop, helicopter],
          color: PLOT_COLORS.orange,
          showPoints: false,
          labels: [
            {
              text: labels.helicopter,
              at: 1,
              offset: [2.4, labelOffsetY * 0.4, 0],
            },
            {
              text: <InlineMath math="?" />,
              at: 0,
              offset: [-labelOffsetX, labelOffsetY * 0.7, 0],
            },
          ],
          cone: { position: "end" },
        },
        {
          points: [groundStart, groundEnd],
          color: PLOT_COLORS.teal,
          showPoints: false,
        },
        {
          points: [
            { x: 0, y: dimensionY, z: 0 },
            { x: totalGround / 2, y: dimensionY, z: 0 },
            { x: totalGround, y: dimensionY, z: 0 },
          ],
          color: PLOT_COLORS.pink,
          showPoints: false,
          cone: { position: "both" },
          labels: [
            {
              text: <InlineMath math="32\,\text{m}" />,
              at: 1,
              offset: [0, -labelOffsetY * 0.4, 0],
            },
          ],
        },
        {
          points: [observationPoint, buildingTop],
          color: PLOT_COLORS.violet,
          showPoints: false,
        },
        {
          points: [observationPoint, helicopter],
          color: PLOT_COLORS.amber,
          showPoints: false,
        },
        {
          points: [
            observerPosition,
            { x: observerPosition.x, y: observerHeight, z: 0 },
          ],
          color: PLOT_COLORS.slate,
          showPoints: false,
          labels: [
            {
              text: labels.observer,
              at: 1,
              offset: [0, labelOffsetY * 0.3, 0],
            },
          ],
        },
        {
          points: [
            { x: observationPoint.x, y: dimensionY_X, z: 0 },
            {
              x: observationPoint.x + shadowLength / 2,
              y: dimensionY_X,
              z: 0,
            },
            { x: observerPosition.x, y: dimensionY_X, z: 0 },
          ],
          color: PLOT_COLORS.slate,
          showPoints: false,
          cone: { position: "both" },
          labels: [
            {
              text: <InlineMath math="x" />,
              at: 1,
              offset: [0, -labelOffsetY * 0.4, 0],
            },
          ],
        },
        {
          points: arc30Points,
          color: PLOT_COLORS.violet,
          showPoints: false,
          labels: [
            {
              text: <InlineMath math="30^\circ" />,
              at: arc30LabelIndex,
              offset: [-labelOffsetX * 0.6, labelOffsetY * 0.05, 0],
            },
          ],
        },
        {
          points: arc45Points,
          color: PLOT_COLORS.amber,
          showPoints: false,
          labels: [
            {
              text: <InlineMath math="45^\circ" />,
              at: arc45LabelIndex,
              offset: [-labelOffsetX * 0.8, labelOffsetY * 0.5, 0],
            },
          ],
        },
      ]}
      facts={<LineReadouts />}
      header={<VisualCardHeader description={description} title={title} />}
      showZAxis={false}
    />
  );
}
