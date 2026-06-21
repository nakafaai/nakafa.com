import { LineEquation } from "@repo/design-system/components/contents/mathematics/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  title: ReactNode;
}

// Scaling factor: 1 unit = 666.67 meters
const scale = 1.5 / 1000;
const height = 3000 * scale;
const pointAOnGround = 0;
const thirtyDegreesInRadians = (30 * Math.PI) / 180;
const fortyFiveDegreesInRadians = (45 * Math.PI) / 180;

// Position 1: Angle 30 degrees (Triangle ABC)
// tan(30) = BC / AB = height / x1 => x1 = height / tan(30)
const thirtyDegreeDistance = height / Math.tan(thirtyDegreesInRadians);

// Position 2: Angle 45 degrees (Triangle ADE)
// tan(45) = DE / AD = height / x2 => x2 = height / tan(45)
const fortyFiveDegreeDistance = height / Math.tan(fortyFiveDegreesInRadians);

/** Generates the visible angle arc points for the airplane-height graph. */
function generateArc(
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
) {
  const steps = 20;
  const startRad = (startAngleDeg * Math.PI) / 180;
  const endRad = (endAngleDeg * Math.PI) / 180;
  const angleStep = (endRad - startRad) / steps;

  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = startRad + i * angleStep;
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: 0,
    };
  });
}

export function Graph({ title, description }: GraphProps) {
  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Ground Line (A -> D -> B)
        {
          points: [
            { x: pointAOnGround, y: 0, z: 0 },
            { x: fortyFiveDegreeDistance, y: 0, z: 0 }, // D
            { x: thirtyDegreeDistance, y: 0, z: 0 }, // B
          ],
          color: getColor("INDIGO"),
          labels: [
            { text: "A (ATC)", at: 0, offset: [-0.5, -0.5, 0] },
            { text: "D", at: 1, offset: [0, -0.5, 0] },
            { text: "B", at: 2, offset: [0, -0.5, 0] },
          ],
        },
        // Plane Path (E -> C)
        {
          points: [
            { x: fortyFiveDegreeDistance, y: height, z: 0 }, // E
            { x: thirtyDegreeDistance, y: height, z: 0 }, // C
          ],
          color: getColor("EMERALD"),
          labels: [
            { text: "E", at: 0, offset: [0, 0.5, 0] },
            { text: "C", at: 1, offset: [0, 0.5, 0] },
          ],
        },
        // Line of Sight 1 (A -> C) - 30 degrees
        {
          points: [
            { x: pointAOnGround, y: 0, z: 0 },
            { x: thirtyDegreeDistance, y: height, z: 0 },
          ],
          color: getColor("ORANGE"),
        },
        // Line of Sight 2 (A -> E) - 45 degrees
        {
          points: [
            { x: pointAOnGround, y: 0, z: 0 },
            { x: fortyFiveDegreeDistance, y: height, z: 0 },
          ],
          color: getColor("TEAL"),
        },
        // Vertical Line (B -> C)
        {
          points: [
            { x: thirtyDegreeDistance, y: 0, z: 0 },
            { x: thirtyDegreeDistance, y: height, z: 0 },
          ],
          color: getColor("INDIGO"),
        },
        // Vertical Line (D -> E)
        {
          points: [
            { x: fortyFiveDegreeDistance, y: 0, z: 0 },
            { x: fortyFiveDegreeDistance, y: height, z: 0 },
          ],
          color: getColor("INDIGO"),
        },
        // Arc 30 degrees
        {
          points: generateArc(1500 * scale, 0, 30),
          color: getColor("VIOLET"),
          labels: [{ text: "30°", at: 10, offset: [0.5, 0, 0] }],
          showPoints: false,
        },
        // Arc 15 degrees (from 30 to 45)
        {
          points: generateArc(2000 * scale, 30, 45),
          color: getColor("VIOLET"),
          labels: [{ text: "15°", at: 10, offset: [0.5, 0.3, 0] }],
          showPoints: false,
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
