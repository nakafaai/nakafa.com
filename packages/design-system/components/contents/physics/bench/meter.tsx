import { Post } from "@repo/design-system/components/contents/physics/bench/lead";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** Where the leads of a meter meet it, the positive post first, on the board it stands on. */
export const METER_POSTS = [
  [0.14, 0, 0.2],
  [-0.14, 0, 0.2],
] as const;

/** How far the needle swings to either side of upright, in radians. */
const SWING = 0.82;

/** Paints a moving-coil meter's dial: a white face, an arc of graduations, and a mirror strip under it. */
function paintDial() {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = INSTRUMENT_COLORS.dialFace;
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = APPARATUS_COLORS.scaleInk;
  ctx.lineCap = "butt";
  for (let tick = 0; tick <= 50; tick += 1) {
    const angle = -Math.PI / 2 - SWING + (tick / 50) * SWING * 2;
    const major = tick % 10 === 0;
    const middle = tick % 5 === 0;
    let inner = 232;
    if (major) {
      inner = 204;
    } else if (middle) {
      inner = 216;
    }
    ctx.lineWidth = major ? 7 : 3.4;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(angle) * inner, 300 + Math.sin(angle) * inner);
    ctx.lineTo(256 + Math.cos(angle) * 250, 300 + Math.sin(angle) * 250);
    ctx.stroke();
  }
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(256, 300, 250, -Math.PI / 2 - SWING, -Math.PI / 2 + SWING);
  ctx.stroke();
  ctx.strokeStyle = APPARATUS_COLORS.nickel;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(256, 300, 184, -Math.PI / 2 - SWING, -Math.PI / 2 + SWING);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * A moving-coil bench meter in a bakelite case, leaning back on its foot: a
 * graduated dial under glass, a needle that stands at `share` of full scale,
 * and a red and a black binding post in front. Its children are the reading
 * it shows, written above it.
 */
export function Meter({
  children,
  share,
}: {
  readonly children: ReactNode;
  readonly share: number;
}) {
  const dial = useMemo(paintDial, []);
  useEffect(() => () => dial?.dispose(), [dial]);
  const swing = SWING - Math.min(1, Math.max(0, share)) * SWING * 2;

  return (
    <group>
      <mesh castShadow position={[0, 0.02, 0.06]} receiveShadow>
        <boxGeometry args={[0.52, 0.04, 0.4]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={APPARATUS_COLORS.bakelite}
          roughness={0.42}
        />
      </mesh>
      <group position={[0, 0.04, -0.04]} rotation={[-0.3, 0, 0]}>
        <mesh castShadow position={[0, 0.2, 0]}>
          <boxGeometry args={[0.5, 0.4, 0.14]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            clearcoatRoughness={0.3}
            color={APPARATUS_COLORS.bakelite}
            roughness={0.38}
          />
        </mesh>
        <mesh position={[0, 0.215, 0.072]}>
          <planeGeometry args={[0.44, 0.275]} />
          <meshStandardMaterial
            color={APPARATUS_COLORS.caseEnamel}
            map={dial}
            roughness={0.7}
          />
        </mesh>
        <group position={[0, 0.095, 0.078]} rotation={[0, 0, swing]}>
          <mesh position={[0, 0.105, 0]}>
            <boxGeometry args={[0.009, 0.21, 0.003]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.dialNeedle}
              roughness={0.4}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.008, 20]} />
            <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
          </mesh>
        </group>
        <mesh position={[0, 0.215, 0.086]}>
          <planeGeometry args={[0.45, 0.285]} />
          <GlassMaterial color={APPARATUS_COLORS.lampGlass} opacity={0.12} />
        </mesh>
      </group>
      <Post color={APPARATUS_COLORS.leadRed} position={METER_POSTS[0]} />
      <Post color={APPARATUS_COLORS.leadBlack} position={METER_POSTS[1]} />
      <Tag position={[0, 0.58, -0.1]}>{children}</Tag>
    </group>
  );
}
