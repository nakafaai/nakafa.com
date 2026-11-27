import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { Lead } from "@repo/design-system/components/contents/physics/bench/lead";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { Vector } from "@repo/design-system/components/contents/physics/bench/vector";
import {
  Column,
  Tube,
} from "@repo/design-system/components/contents/physics/bench/vessel";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** The U-tube: how far each arm stands from the middle, its bore, where the bend sits, where the arms end, and where the liquid rests. */
const ARM = 0.27;
const BORE = 0.05;
const BEND = 0.62;
const TOP = 2.16;
const REST = 1.34;
/** How much of the arms the largest difference may take up. */
const REACH = 1.2;

const HOSE = [
  [-ARM, TOP + 0.02, 0],
  [-ARM, TOP + 0.2, 0],
  [-ARM - 0.26, TOP + 0.3, 0.05],
  [-ARM - 0.9, TOP - 0.1, 0.2],
  [-ARM - 1.15, 1.2, 0.3],
  [-ARM - 1.2, 0.62, 0.3],
] as const;

/** Paints the scale behind the U-tube: a cream card ruled every division, with a longer line at every fifth. */
function paintScale() {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = APPARATUS_COLORS.scalePaper;
  ctx.fillRect(0, 0, 256, 1024);
  ctx.strokeStyle = APPARATUS_COLORS.scaleInk;
  for (let line = 0; line <= 100; line += 1) {
    const y = 12 + line * 10;
    const long = line % 5 === 0;
    ctx.lineWidth = long ? 5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(128 - (long ? 40 : 22), y);
    ctx.lineTo(128 + (long ? 40 : 22), y);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * The U-tube manometer on its stand: two glass arms joined by a bend, in
 * front of a ruled scale, with a rubber hose from the left arm to the gas
 * tap and the right arm open to the air. The gas pushes its side down and
 * the open side up by half the difference each, which is marked beside the
 * arms.
 */
export function ManometerScene({
  dense,
  difference,
  most,
}: {
  /** Whether the manometer liquid is a heavy one, such as mercury, which does not wet glass. */
  readonly dense: boolean;
  readonly difference: number;
  readonly most: number;
}) {
  const quantity = useQuantity();
  const scale = useMemo(paintScale, []);
  useEffect(() => () => scale?.dispose(), [scale]);
  const half = ((difference / Math.max(most, 1)) * REACH) / 2;
  const color = dense
    ? QUANTUM_COLORS.mercuryLiquid
    : APPARATUS_COLORS.dyedWater;

  return (
    <group>
      <BenchCamera
        narrow={[0.3, 1.9, 6.6]}
        target={[-0.35, 1.3, 0]}
        wide={[0.4, 1.6, 4.7]}
      />
      <SeamlessBenchSurface />
      <mesh castShadow position={[0, 0.04, -0.02]} receiveShadow>
        <boxGeometry args={[1.3, 0.08, 0.6]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={APPARATUS_COLORS.bakeliteBrown}
          roughness={0.5}
        />
      </mesh>
      <mesh castShadow position={[0, 1.24, -0.13]} receiveShadow>
        <boxGeometry args={[1.02, 2.34, 0.05]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={APPARATUS_COLORS.bakeliteBrown}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 1.36, -0.1]}>
        <planeGeometry args={[0.36, 1.72]} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.caseEnamel}
          map={scale}
          roughness={0.8}
        />
      </mesh>
      <group position={[-ARM, 0, 0]}>
        <Tube bottom={BEND} height={TOP - BEND} radius={BORE} />
        <Column
          bottom={BEND}
          color={color}
          convex={dense}
          level={REST - half}
          opacity={dense ? 0.96 : 0.74}
          radius={BORE}
        />
      </group>
      <group position={[ARM, 0, 0]}>
        <Tube bottom={BEND} height={TOP - BEND} radius={BORE} />
        <Column
          bottom={BEND}
          color={color}
          convex={dense}
          level={REST + half}
          opacity={dense ? 0.96 : 0.74}
          radius={BORE}
        />
      </group>
      <mesh position={[0, BEND, 0]} renderOrder={3} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[ARM, BORE + 0.012, 16, 48, Math.PI]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.22} />
      </mesh>
      <mesh position={[0, BEND, 0]} renderOrder={1} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[ARM, BORE, 14, 48, Math.PI]} />
        <LiquidMaterial color={color} opacity={dense ? 0.96 : 0.74} />
      </mesh>
      <Lead color={APPARATUS_COLORS.rubberTube} points={HOSE} radius={0.05} />
      <group position={[-ARM - 1.2, 0, 0.3]}>
        <mesh castShadow position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.6, 16]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.28} />
        </mesh>
        <mesh castShadow position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.16, 0.18, 0.06, 32]} />
          <MetalMaterial color={QUANTUM_COLORS.brass} roughness={0.32} />
        </mesh>
        <mesh
          castShadow
          position={[0.09, 0.42, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.2, 12]} />
          <meshPhysicalMaterial
            clearcoat={0.5}
            color={APPARATUS_COLORS.leadRed}
            roughness={0.4}
          />
        </mesh>
      </group>
      <Tag position={[-ARM - 0.95, TOP + 0.34, 0.1]}>
        <InlineMath math="p_{\text{gas}}" />
      </Tag>
      <Tag position={[ARM + 0.1, TOP + 0.3, 0]}>
        <InlineMath math="p_{\text{atm}}" />
      </Tag>
      <Vector
        color={APPARATUS_COLORS.weightArrow}
        from={[ARM + 0.3, REST - half, 0]}
        to={[ARM + 0.3, REST + half, 0]}
      >
        <InlineMath math={`h=${quantity(difference, "\\text{ cm}", 1)}`} />
      </Vector>
    </group>
  );
}
