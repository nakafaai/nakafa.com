import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
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

export function Graph({ title, description, labels }: GraphProps) {
  const scale = 4;
  const buildingHeight = 16 / scale;
  const observationDistance = (16 * Math.sqrt(3)) / scale;
  const helicopterHeight = observationDistance * Math.tan(Math.PI / 4);
  const shadowLength = 2;
  const observerHeight = 2;
  const totalGround = observationDistance + shadowLength;
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

  const origin = { x: 0, y: 0, z: 0 };
  const buildingTop = { x: 0, y: buildingHeight, z: 0 };
  const helicopter = { x: 0, y: helicopterHeight, z: 0 };
  const observationPoint = { x: observationDistance, y: 0, z: 0 };
  const observerPosition = { x: totalGround, y: 0, z: 0 };
  const groundStart = { x: -groundPadding, y: 0, z: 0 };
  const groundEnd = { x: totalGround + groundPadding, y: 0, z: 0 };
  const dimensionY = -labelOffsetY * 0.4;
  const dimensionY_X = -labelOffsetY * 0.8;

  return (
    <LineEquation
      cameraPosition={[0, 0, 18]}
      data={[
        {
          points: [origin, buildingTop],
          color: getColor("INDIGO"),
          showPoints: false,
          labels: [
            {
              text: "16 m",
              at: 1,
              offset: [-labelOffsetX, -labelOffsetY, 0],
              color: getColor("INDIGO"),
            },
            {
              text: labels.building,
              at: 1,
              offset: [-labelOffsetX * 1.5, -labelOffsetY * 0.3, 0],
              color: getColor("INDIGO"),
            },
          ],
        },
        {
          points: [buildingTop, helicopter],
          color: getColor("ORANGE"),
          showPoints: false,
          labels: [
            {
              text: labels.helicopter,
              at: 1,
              offset: [labelOffsetX * 0.3, labelOffsetY * 0.4, 0],
              color: getColor("ORANGE"),
            },
            {
              text: "?",
              at: 0,
              offset: [-labelOffsetX, labelOffsetY * 0.7, 0],
              color: getColor("ORANGE"),
            },
          ],
          cone: { position: "end" },
        },
        {
          points: [groundStart, groundEnd],
          color: getColor("TEAL"),
          showPoints: false,
        },
        {
          points: [
            { x: 0, y: dimensionY, z: 0 },
            { x: totalGround / 2, y: dimensionY, z: 0 },
            { x: totalGround, y: dimensionY, z: 0 },
          ],
          color: getColor("ROSE"),
          showPoints: false,
          cone: { position: "both" },
          labels: [
            {
              text: "32 m",
              at: 1,
              offset: [0, -labelOffsetY * 0.4, 0],
              color: getColor("ROSE"),
            },
          ],
        },
        {
          points: [observationPoint, buildingTop],
          color: getColor("VIOLET"),
          showPoints: false,
        },
        {
          points: [observationPoint, helicopter],
          color: getColor("EMERALD"),
          showPoints: false,
        },
        {
          points: [
            observerPosition,
            { x: observerPosition.x, y: observerHeight, z: 0 },
          ],
          color: getColor("CYAN"),
          showPoints: false,
          labels: [
            {
              text: labels.observer,
              at: 1,
              offset: [0, labelOffsetY * 0.3, 0],
              color: getColor("CYAN"),
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
          color: getColor("CYAN"),
          showPoints: false,
          cone: { position: "both" },
          labels: [
            {
              text: "x",
              at: 1,
              offset: [0, -labelOffsetY * 0.4, 0],
              color: getColor("CYAN"),
            },
          ],
        },
        {
          points: arc30Points,
          color: getColor("VIOLET"),
          showPoints: false,
          labels: [
            {
              text: "30°",
              at: arc30LabelIndex,
              offset: [-labelOffsetX * 0.6, labelOffsetY * 0.05, 0],
              color: getColor("VIOLET"),
            },
          ],
        },
        {
          points: arc45Points,
          color: getColor("EMERALD"),
          showPoints: false,
          labels: [
            {
              text: "45°",
              at: arc45LabelIndex,
              offset: [-labelOffsetX * 0.8, labelOffsetY * 0.15, 0],
              color: getColor("EMERALD"),
            },
          ],
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
