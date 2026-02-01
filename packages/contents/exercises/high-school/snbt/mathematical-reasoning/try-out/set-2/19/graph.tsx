import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

export function Graph() {
  // Scaling factor: 1 unit = 666.67 meters
  const SCALE = 1.5 / 1000;
  const HEIGHT = 3000 * SCALE; // y = 4.5

  // Position 1: Angle 30 degrees (Triangle ABC)
  // tan(30) = BC / AB = HEIGHT / x1 => x1 = HEIGHT / tan(30)
  const x1 = HEIGHT / Math.tan((30 * Math.PI) / 180);

  // Position 2: Angle 45 degrees (Triangle ADE)
  // tan(45) = DE / AD = HEIGHT / x2 => x2 = HEIGHT / tan(45)
  const x2 = HEIGHT / Math.tan((45 * Math.PI) / 180);

  // Tower position (Point A)
  const xA = 0;

  const generateArc = (
    radius: number,
    startAngleDeg: number,
    endAngleDeg: number
  ) => {
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
  };

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Ground Line (A -> D -> B)
        {
          points: [
            { x: xA, y: 0, z: 0 },
            { x: x2, y: 0, z: 0 }, // D
            { x: x1, y: 0, z: 0 }, // B
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
            { x: x2, y: HEIGHT, z: 0 }, // E
            { x: x1, y: HEIGHT, z: 0 }, // C
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
            { x: xA, y: 0, z: 0 },
            { x: x1, y: HEIGHT, z: 0 },
          ],
          color: getColor("ORANGE"),
        },
        // Line of Sight 2 (A -> E) - 45 degrees
        {
          points: [
            { x: xA, y: 0, z: 0 },
            { x: x2, y: HEIGHT, z: 0 },
          ],
          color: getColor("TEAL"),
        },
        // Vertical Line (B -> C)
        {
          points: [
            { x: x1, y: 0, z: 0 },
            { x: x1, y: HEIGHT, z: 0 },
          ],
          color: getColor("INDIGO"),
        },
        // Vertical Line (D -> E)
        {
          points: [
            { x: x2, y: 0, z: 0 },
            { x: x2, y: HEIGHT, z: 0 },
          ],
          color: getColor("INDIGO"),
        },
        // Arc 30 degrees
        {
          points: generateArc(1500 * SCALE, 0, 30),
          color: getColor("VIOLET"),
          labels: [{ text: "30°", at: 10, offset: [0.5, 0, 0] }],
          showPoints: false,
        },
        // Arc 15 degrees (from 30 to 45)
        {
          points: generateArc(2000 * SCALE, 30, 45),
          color: getColor("VIOLET"),
          labels: [{ text: "15°", at: 10, offset: [0.5, 0.3, 0] }],
          showPoints: false,
        },
      ]}
      description="Visualisasi posisi pesawat relatif terhadap menara ATC."
      showZAxis={false}
      title="Ilustrasi Pergerakan Pesawat"
    />
  );
}
