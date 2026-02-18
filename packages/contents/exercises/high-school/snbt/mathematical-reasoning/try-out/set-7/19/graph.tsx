import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";

interface GraphProps {
  description: React.ReactNode;
  labels: {
    atc: string;
    initialPos: string;
    finalPos: string;
    height: string;
  };
  title: string;
}

export function Graph({ title, description, labels }: GraphProps) {
  // Constants
  // Real values: Height = 3000m
  // Scale up for better visualization in cameraPosition [0, 0, 15]
  const HEIGHT = 5.5;

  const ANGLE_1_DEG = 30;
  const ANGLE_1_RAD = (ANGLE_1_DEG * Math.PI) / 180;

  const ANGLE_2_DEG = 45;
  const ANGLE_2_RAD = (ANGLE_2_DEG * Math.PI) / 180;

  // Coordinates relative to origin (0,0)
  // x = h / tan(angle)
  const dist1 = HEIGHT / Math.tan(ANGLE_1_RAD); // 30 deg distance (longer)
  const dist2 = HEIGHT / Math.tan(ANGLE_2_RAD); // 45 deg distance (shorter)

  // Center calculation
  // Min X = 0 (A), Max X = dist1
  // Min Y = 0 (A), Max Y = HEIGHT
  // Center = (dist1/2, HEIGHT/2)
  const OFFSET = {
    x: -dist1 / 2,
    y: -HEIGHT / 2,
    z: 0,
  };

  const pA = { x: 0 + OFFSET.x, y: 0 + OFFSET.y, z: 0 };
  const pB = { x: dist1 + OFFSET.x, y: 0 + OFFSET.y, z: 0 }; // Ground projection of C
  const pC = { x: dist1 + OFFSET.x, y: HEIGHT + OFFSET.y, z: 0 }; // Initial (30 deg)
  const pD = { x: dist2 + OFFSET.x, y: 0 + OFFSET.y, z: 0 }; // Ground projection of E
  const pE = { x: dist2 + OFFSET.x, y: HEIGHT + OFFSET.y, z: 0 }; // Final (45 deg)

  // Midpoints for cleaner labels
  const MID_HEIGHT = {
    x: pB.x,
    y: (pB.y + pC.y) / 2,
    z: 0,
  };

  // Colors
  const COLOR_GROUND = getColor("CYAN");
  const COLOR_SIGHT = getColor("ORANGE");
  const COLOR_PATH = getColor("TEAL");
  const COLOR_HEIGHT = getColor("INDIGO");
  const COLOR_LABEL = getColor("VIOLET");
  const COLOR_ATC = getColor("AMBER");

  // Arcs for angles
  // Arc 1: 30 degrees (larger radius to avoid clutter)
  const ARC_RADIUS_1 = 4.0;
  const ARC_POINTS_1 = Array.from({ length: 30 }, (_, i) => {
    const t = (i / 29) * ANGLE_1_RAD;
    return {
      x: pA.x + ARC_RADIUS_1 * Math.cos(t),
      y: pA.y + ARC_RADIUS_1 * Math.sin(t),
      z: 0,
    };
  });

  // Arc 2: 45 degrees (smaller radius)
  const ARC_RADIUS_2 = 2.0;
  const ARC_POINTS_2 = Array.from({ length: 30 }, (_, i) => {
    const t = (i / 29) * ANGLE_2_RAD;
    return {
      x: pA.x + ARC_RADIUS_2 * Math.cos(t),
      y: pA.y + ARC_RADIUS_2 * Math.sin(t),
      z: 0,
    };
  });

  // Label positions for angles
  // 30 deg label: put it at half angle (15 deg), slightly beyond arc radius
  const LABEL_POS_1 = {
    x: pA.x + (ARC_RADIUS_1 + 0.5) * Math.cos(ANGLE_1_RAD / 2),
    y: pA.y + (ARC_RADIUS_1 + 0.5) * Math.sin(ANGLE_1_RAD / 2),
    z: 0,
  };

  // 45 deg label: put it at half angle (22.5 deg), slightly beyond arc radius
  const LABEL_POS_2 = {
    x: pA.x + (ARC_RADIUS_2 + 0.5) * Math.cos(ANGLE_2_RAD / 2),
    y: pA.y + (ARC_RADIUS_2 + 0.5) * Math.sin(ANGLE_2_RAD / 2),
    z: 0,
  };

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Ground Line (A to B)
        {
          points: [pA, pB],
          color: COLOR_GROUND,
          showPoints: true, // Show A and B
          labels: [
            {
              text: labels.atc,
              at: 0, // At A
              offset: [0, -0.6, 0], // Below A
              color: COLOR_ATC,
            },
          ],
        },
        // Height Line (B to C)
        {
          points: [pB, pC],
          color: COLOR_HEIGHT,
          showPoints: true, // Show C
        },
        // Height Line with Midpoint for Label
        {
          points: [pB, MID_HEIGHT, pC],
          color: COLOR_HEIGHT,
          showPoints: false,
          labels: [
            {
              text: labels.height,
              at: 1, // Midpoint
              offset: [1, 0.5, 0], // Moved up to avoid X-axis overlap
              color: COLOR_HEIGHT,
            },
            {
              text: labels.initialPos,
              at: 2, // At C
              offset: [1.5, 0.6, 0], // Shifted right to separate from Final Pos
              color: COLOR_PATH,
            },
          ],
        },
        // Line of Sight 1 (A to C - 30 deg)
        {
          points: [pA, pC],
          color: COLOR_SIGHT,
          showPoints: false,
        },
        // Line of Sight 2 (A to E - 45 deg)
        {
          points: [pA, pE],
          color: COLOR_SIGHT,
          showPoints: true, // Show E
          labels: [
            {
              text: labels.finalPos,
              at: 1, // At E
              offset: [-1.5, 0.6, 0], // Shifted left to separate from Initial Pos
              color: COLOR_PATH,
            },
          ],
        },
        // Plane Path (E to C or C to E)
        {
          points: [pC, pE],
          color: COLOR_PATH,
          showPoints: false,
        },
        // Projection line for E (D to E)
        {
          points: [pD, pE],
          color: COLOR_HEIGHT,
          showPoints: true, // Show D
        },
        // Arc 1 (30 deg)
        {
          points: ARC_POINTS_1,
          color: COLOR_LABEL,
          showPoints: false,
        },
        // Label 30 deg (Manual point)
        {
          points: [LABEL_POS_1],
          color: COLOR_LABEL,
          showPoints: false,
          labels: [
            { text: "30°", at: 0, offset: [0, 0, 0], color: COLOR_LABEL },
          ],
        },
        // Arc 2 (45 deg)
        {
          points: ARC_POINTS_2,
          color: COLOR_LABEL,
          showPoints: false,
        },
        // Label 45 deg (Manual point)
        {
          points: [LABEL_POS_2],
          color: COLOR_LABEL,
          showPoints: false,
          labels: [
            { text: "45°", at: 0, offset: [0, 0, 0], color: COLOR_LABEL },
          ],
        },
      ]}
      description={description}
      showZAxis={false}
      title={title}
    />
  );
}
