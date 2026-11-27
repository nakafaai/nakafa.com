import { latheProfile } from "@repo/design-system/components/contents/chemistry/glassware";
import { Tag } from "@repo/design-system/components/contents/physics/bench/tag";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import type { ReactNode, Ref } from "react";
import { useEffect, useMemo } from "react";
import type { Group } from "three";
import { CanvasTexture, SRGBColorSpace } from "three";

/** Where the thread of a thermometer begins above its bulb, and how much of the stem stays clear above the scale. */
const NECK = 0.13;
const CROWN = 0.1;

/** Paints the scale strip sealed inside the stem: a white enamel band ruled every degree, longer at every fifth. */
function paintScale() {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillStyle = APPARATUS_COLORS.scalePaper;
  ctx.fillRect(0, 0, 64, 1024);
  ctx.strokeStyle = APPARATUS_COLORS.scaleInk;
  for (let line = 0; line <= 50; line += 1) {
    const y = 12 + line * 20;
    const long = line % 5 === 0;
    ctx.lineWidth = long ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(long ? 6 : 22, y);
    ctx.lineTo(58, y);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * A laboratory alcohol thermometer standing upright with its bulb at the
 * origin: a glass stem `tall` long over a red bulb, a ruled enamel strip
 * behind the thread, and the red thread standing `share` of the way up the
 * scale. A rig that warms smoothly holds `thread` and sets its `scale.y`
 * to that share on every frame. Its children are the reading, written
 * above the stem.
 */
export function Thermometer({
  children,
  share,
  tall,
  thread,
}: {
  readonly children: ReactNode;
  readonly share: number;
  readonly tall: number;
  readonly thread: Ref<Group>;
}) {
  const scale = useMemo(paintScale, []);
  useEffect(() => () => scale?.dispose(), [scale]);
  const span = tall - NECK - CROWN;
  const stem = useMemo(
    () =>
      latheProfile([
        [0.001, -0.05],
        [0.03, -0.04],
        [0.046, -0.008],
        [0.046, 0.03],
        [0.034, 0.07],
        [0.03, 0.1],
        [0.03, tall - 0.02],
        [0.022, tall],
        [0.001, tall + 0.004],
      ]),
    [tall]
  );

  return (
    <group>
      <mesh position={[0, NECK + span / 2, -0.008]}>
        <planeGeometry args={[0.044, span]} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.caseEnamel}
          map={scale}
          roughness={0.7}
        />
      </mesh>
      <mesh position={[0, 0.006, 0]}>
        <sphereGeometry args={[0.037, 20, 16]} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.alcohol}
          emissive={APPARATUS_COLORS.alcohol}
          emissiveIntensity={0.25}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, NECK / 2 + 0.02, 0]}>
        <cylinderGeometry args={[0.008, 0.008, NECK - 0.03, 12]} />
        <meshStandardMaterial
          color={APPARATUS_COLORS.alcohol}
          emissive={APPARATUS_COLORS.alcohol}
          emissiveIntensity={0.25}
          roughness={0.25}
        />
      </mesh>
      <group position={[0, NECK, 0]} scale={[1, span, 1]}>
        <group ref={thread} scale={[1, Math.min(1, Math.max(0.02, share)), 1]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1, 12]} />
            <meshStandardMaterial
              color={APPARATUS_COLORS.alcohol}
              emissive={APPARATUS_COLORS.alcohol}
              emissiveIntensity={0.25}
              roughness={0.25}
            />
          </mesh>
        </group>
      </group>
      <mesh castShadow renderOrder={4}>
        <latheGeometry args={[stem, 24]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.26} />
      </mesh>
      <Tag position={[0, tall + 0.16, 0]}>{children}</Tag>
    </group>
  );
}
