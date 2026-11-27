import { PrintBall } from "@repo/design-system/components/three/print/layer";
import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { ballSheet } from "@repo/design-system/components/three/print/wrap";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { useMemo } from "react";

/**
 * What is moulded into a sports ball's cover: a screen of grip pebbles, and
 * the channel seams round its equator and down two meridians, so its spin
 * and its height stay legible across every frame.
 */
function coverSheet(radius: number, seamColor: string): Sheet {
  const { height, width } = ballSheet(radius);
  const seam = height * 0.025;
  return {
    height,
    marks: [
      {
        ink: CAR_COLORS.tyre,
        kind: "dots",
        pitch: width * 0.0176,
        radius: width * 0.003,
        strength: 0.13,
      },
      {
        from: [-width / 2, 0],
        ink: seamColor,
        kind: "line",
        to: [width / 2, 0],
        width: seam,
      },
      {
        from: [-width / 4, -height / 2],
        ink: seamColor,
        kind: "line",
        to: [-width / 4, height / 2],
        width: seam,
      },
      {
        from: [width / 4, -height / 2],
        ink: seamColor,
        kind: "line",
        to: [width / 4, height / 2],
        width: seam,
      },
    ],
    width,
  };
}

/**
 * Shared pebbled composite sports ball with channel seams and satin clearcoat,
 * reused across kinematics launch and free-fall labs with zero duplication.
 */
export function SportsBall({
  color,
  radius,
  seamColor = CAR_COLORS.tyre,
}: {
  readonly color: string;
  readonly radius: number;
  readonly seamColor?: string;
}) {
  const cover = useMemo(
    () => coverSheet(radius, seamColor),
    [radius, seamColor]
  );

  return (
    <mesh castShadow>
      <sphereGeometry args={[radius, 48, 32]} />
      <meshPhysicalMaterial
        clearcoat={0.26}
        clearcoatRoughness={0.46}
        color={color}
        roughness={0.54}
      />
      <PrintBall radius={radius} sheet={cover} stock="engraving" />
    </mesh>
  );
}
