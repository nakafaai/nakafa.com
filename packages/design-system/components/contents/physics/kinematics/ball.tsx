import { getColor } from "@repo/design-system/lib/color";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

const BALL_BASE_WHITE = getColor("WHITE");

function createSportsBallTexture(
  color: string,
  seamColor: string
): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle composite grip dimples for realistic leather grain
  ctx.fillStyle = CAR_COLORS.tyre;
  ctx.globalAlpha = 0.13;
  for (let y = 5; y < 256; y += 9) {
    for (let x = 5; x < 512; x += 9) {
      ctx.beginPath();
      ctx.arc(x + ((y / 9) % 2) * 4.5, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Channel seams so spin and elevation stay legible across every frame
  ctx.strokeStyle = seamColor;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(384, 0);
  ctx.lineTo(384, 256);
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
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
  const texture = useMemo(
    () => createSportsBallTexture(color, seamColor),
    [color, seamColor]
  );

  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <mesh castShadow>
      <sphereGeometry args={[radius, 48, 32]} />
      <meshPhysicalMaterial
        clearcoat={0.26}
        clearcoatRoughness={0.46}
        color={texture === null ? color : BALL_BASE_WHITE}
        map={texture}
        roughness={0.54}
      />
    </mesh>
  );
}
