import { LineEquation } from "@repo/design-system/components/contents/line-equation";
import { getColor } from "@repo/design-system/lib/color";
import type { ReactNode } from "react";

interface GraphProps {
  description: ReactNode;
  labels: {
    eagle: string;
    fish: string;
    surface: string;
    sightDistance: string;
  };
  title: ReactNode;
}

export function Graph({ title, description, labels }: GraphProps) {
  // Constants (Scaled down for better visualization at cameraPosition [0, 0, 15])
  // Original: FISH_DEPTH = 3, SIGHT_DISTANCE = 18
  // Scale factor: 0.5
  const SCALE_FACTOR = 0.5;
  const ANGLE_DEG = 30;
  const ANGLE_RAD = (ANGLE_DEG * Math.PI) / 180;
  const FISH_DEPTH = 3 * SCALE_FACTOR;
  const SIGHT_DISTANCE = 18 * SCALE_FACTOR;

  // Calculate coordinates
  // Fish (F) is at depth FISH_DEPTH, so y = -FISH_DEPTH
  // x coordinate of Fish: tan(30) = FISH_DEPTH / |x_F| => |x_F| = FISH_DEPTH / tan(30)
  // We place Fish to the left, so x is negative.
  const fishX = -FISH_DEPTH / Math.tan(ANGLE_RAD);
  const F = { x: fishX, y: -FISH_DEPTH, z: 0 };

  // Eagle (E) position based on Fish position and Sight Distance
  // E.x = F.x + SIGHT_DISTANCE * Math.cos(ANGLE_RAD)
  // E.y = F.y + SIGHT_DISTANCE * Math.sin(ANGLE_RAD)
  const E = {
    x: F.x + SIGHT_DISTANCE * Math.cos(ANGLE_RAD),
    y: F.y + SIGHT_DISTANCE * Math.sin(ANGLE_RAD),
    z: 0,
  };

  // Water Surface Line
  // Scale down surface range as well
  const SURFACE_RANGE = 15 * SCALE_FACTOR;
  const SURFACE_START = { x: -SURFACE_RANGE, y: 0, z: 0 };
  const SURFACE_END = { x: SURFACE_RANGE, y: 0, z: 0 };
  const SURFACE_MID = {
    x: (SURFACE_START.x + SURFACE_END.x) / 2,
    y: (SURFACE_START.y + SURFACE_END.y) / 2,
    z: (SURFACE_START.z + SURFACE_END.z) / 2,
  };
  const SURFACE_LABEL_POS = {
    x: SURFACE_RANGE * 0.8, // 80% to the right
    y: 0,
    z: 0,
  };

  // Projection points for height/depth visualization
  const F_PROJ = { x: F.x, y: 0, z: 0 }; // Point on surface above fish
  const E_PROJ = { x: E.x, y: 0, z: 0 }; // Point on surface below eagle

  // Angle Arc
  // Create points for an arc at the intersection (0,0,0) from 0 to 30 degrees
  const ARC_RADIUS = 3.5 * SCALE_FACTOR;
  const ARC_POINTS = Array.from({ length: 20 }, (_, i) => {
    const t = (i / 19) * ANGLE_RAD; // 0 to 30 degrees
    return {
      x: ARC_RADIUS * Math.cos(t),
      y: ARC_RADIUS * Math.sin(t),
      z: 0,
    };
  });

  // Calculate precise label position for 30° to avoid overlap with lines
  const LABEL_RADIUS = ARC_RADIUS + 1.5 * SCALE_FACTOR; // Push it out further than arc
  const LABEL_ANGLE = ANGLE_RAD / 2; // Middle of the angle (15 degrees)
  const LABEL_POS = {
    x: LABEL_RADIUS * Math.cos(LABEL_ANGLE),
    y: LABEL_RADIUS * Math.sin(LABEL_ANGLE),
    z: 0,
  };

  // Midpoints for labels (to avoid decimal 'at' values)
  const SIGHT_MID = {
    x: (F.x + E.x) / 2,
    y: (F.y + E.y) / 2,
    z: (F.z + E.z) / 2,
  };
  const FISH_DEPTH_MID = {
    x: (F.x + F_PROJ.x) / 2,
    y: (F.y + F_PROJ.y) / 2,
    z: (F.z + F_PROJ.z) / 2,
  };
  const EAGLE_HEIGHT_MID = {
    x: (E.x + E_PROJ.x) / 2,
    y: (E.y + E_PROJ.y) / 2,
    z: (E.z + E_PROJ.z) / 2,
  };

  // Colors
  const COLOR_WATER = getColor("CYAN");
  const COLOR_SIGHT = getColor("ORANGE");
  const COLOR_DEPTH = getColor("INDIGO"); // Vertical lines
  const COLOR_EAGLE = getColor("AMBER");
  const COLOR_FISH = getColor("TEAL");
  const COLOR_LABEL = getColor("VIOLET");

  return (
    <LineEquation
      cameraPosition={[0, 0, 15]}
      data={[
        // Water Surface
        {
          points: [SURFACE_START, SURFACE_MID, SURFACE_LABEL_POS, SURFACE_END],
          color: COLOR_WATER,
          showPoints: false,
          labels: [
            {
              text: labels.surface,
              at: 2, // At SURFACE_LABEL_POS
              offset: [0, -0.6, 0], // Below x-axis
              color: COLOR_WATER,
            },
          ],
        },
        // Angle Arc
        {
          points: ARC_POINTS,
          color: COLOR_LABEL,
          showPoints: false,
          // Removed duplicate label logic, relying on separate point below
        },
        // Angle Label
        {
          points: [LABEL_POS],
          color: COLOR_LABEL,
          showPoints: false,
          labels: [
            {
              text: "30°",
              at: 0,
              offset: [0, 0, 0],
              color: COLOR_LABEL,
            },
          ],
        },
        // Line of Sight (Fish to Eagle)
        {
          points: [F, SIGHT_MID, E],
          color: COLOR_SIGHT,
          showPoints: false,
          labels: [
            {
              text: labels.sightDistance,
              at: 1, // Midpoint
              offset: [0, 1, 0],
              color: COLOR_SIGHT,
            },
            // Removed 30 deg label from here
          ],
        },
        // Fish Depth Line
        {
          points: [F, FISH_DEPTH_MID, F_PROJ],
          color: COLOR_DEPTH,
          showPoints: false,
          labels: [
            {
              text: "3m",
              at: 1, // Midpoint
              offset: [-0.8, 0, 0], // Adjusted offset
              color: COLOR_DEPTH,
            },
          ],
        },
        // Eagle Height Line
        {
          points: [E, EAGLE_HEIGHT_MID, E_PROJ],
          color: COLOR_DEPTH,
          showPoints: false,
          labels: [
            {
              text: "h = ?",
              at: 1, // Midpoint
              offset: [1, 0, 0], // Adjusted offset
              color: COLOR_DEPTH,
            },
          ],
        },
        // Points of interest
        {
          points: [F],
          color: COLOR_FISH,
          showPoints: true,
          labels: [
            {
              text: labels.fish,
              at: 0,
              offset: [0, -0.8, 0], // Adjusted offset
              color: COLOR_FISH,
            },
          ],
        },
        {
          points: [E],
          color: COLOR_EAGLE,
          showPoints: true,
          labels: [
            {
              text: labels.eagle,
              at: 0,
              offset: [0, 0.8, 0], // Adjusted offset
              color: COLOR_EAGLE,
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
