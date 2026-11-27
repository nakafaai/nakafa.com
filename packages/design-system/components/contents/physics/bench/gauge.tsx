import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** How far the needle of the gauge turns from zero to full scale, in radians. */
const SWEEP = Math.PI * 1.5;

/** Paints the dial of a Bourdon gauge: a white face with a three-quarter ring of graduations, the last fifth in red. */
function paintDial() {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = INSTRUMENT_COLORS.dialFace;
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  for (let tick = 0; tick <= 40; tick += 1) {
    const angle = Math.PI * 0.75 + (tick / 40) * SWEEP;
    const major = tick % 5 === 0;
    ctx.strokeStyle =
      tick >= 32 ? INSTRUMENT_COLORS.dialNeedle : APPARATUS_COLORS.scaleInk;
    ctx.lineWidth = major ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(
      128 + Math.cos(angle) * (major ? 86 : 98),
      128 + Math.sin(angle) * (major ? 86 : 98)
    );
    ctx.lineTo(128 + Math.cos(angle) * 114, 128 + Math.sin(angle) * 114);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * A Bourdon pressure gauge on a brass stem, its face toward the reader: a
 * machined brass case, a graduated dial under glass, and a needle that
 * stands at `share` of full scale. Its children are the reading it shows,
 * written above it.
 */
export function Gauge({
  children,
  share,
}: {
  readonly children: ReactNode;
  readonly share: number;
}) {
  const dial = useMemo(paintDial, []);
  useEffect(() => () => dial?.dispose(), [dial]);
  const turn = Math.PI * 0.75 - Math.min(1, Math.max(0, share)) * SWEEP;

  return (
    <group>
      <mesh castShadow position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.03, 0.036, 0.18, 16]} />
        <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.3} />
      </mesh>
      <group position={[0, 0.36, 0]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.09, 48]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0, 0.047]}>
          <circleGeometry args={[0.178, 48]} />
          <meshStandardMaterial
            color={APPARATUS_COLORS.caseEnamel}
            map={dial}
            roughness={0.6}
          />
        </mesh>
        <group position={[0, 0, 0.052]} rotation={[0, 0, turn]}>
          <mesh position={[0.06, 0, 0]}>
            <boxGeometry args={[0.15, 0.012, 0.004]} />
            <meshStandardMaterial
              color={INSTRUMENT_COLORS.dialNeedle}
              roughness={0.4}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.01, 18]} />
            <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.3} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.062]}>
          <circleGeometry args={[0.182, 48]} />
          <GlassMaterial color={APPARATUS_COLORS.lampGlass} opacity={0.12} />
        </mesh>
        <mesh position={[0, 0, 0.05]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.19, 0.014, 12, 48]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.22} />
        </mesh>
      </group>
      <Tag position={[0, 0.7, 0]}>{children}</Tag>
    </group>
  );
}
