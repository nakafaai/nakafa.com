import {
  latheProfile,
  liquidMeniscus,
} from "@repo/design-system/components/contents/chemistry/glassware";
import {
  GlassMaterial,
  LiquidMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

/** Printed laboratory jar/bottle/plaque paper label with formula, subtitle, and stripe. */
export function createPrintedLabelTexture({
  accentColor,
  background = BOTANY_COLORS.labelPaper,
  badge,
  inkColor = BOTANY_COLORS.labelInk,
  subtitle,
  title,
}: {
  readonly accentColor: string;
  readonly background?: string;
  readonly badge: string;
  readonly inkColor?: string;
  readonly subtitle: string;
  readonly title: string;
}): CanvasTexture | null {
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
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = BOTANY_COLORS.labelBorder;
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 488, 232);
  ctx.fillStyle = accentColor;
  ctx.fillRect(12, 188, 488, 56);

  ctx.fillStyle = inkColor;
  ctx.textAlign = "center";
  const fontSize = title.length > 16 ? 38 : 50;
  ctx.font = `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(title, 256, 98);

  ctx.font = "600 28px ui-monospace, monospace";
  ctx.fillText(subtitle, 256, 152);

  ctx.fillStyle = getColor("WHITE");
  ctx.font = "700 24px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(badge, 256, 224);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Lathed borosilicate glass beaker/jar with concave meniscus and crisp printed label. */
export function LabeledVessel({
  accentColor,
  badge,
  fillFraction = 0.7,
  height = 0.46,
  liquidColor,
  position = [0, 0, 0],
  radius = 0.16,
  subtitle,
  title,
}: {
  readonly accentColor: string;
  readonly badge: string;
  readonly fillFraction?: number;
  readonly height?: number;
  readonly liquidColor: string;
  readonly position?: readonly [number, number, number];
  readonly radius?: number;
  readonly subtitle: string;
  readonly title: string;
}) {
  const glassPoints = useMemo(
    () =>
      latheProfile([
        [0.001, 0],
        [radius * 0.94, 0],
        [radius, height * 0.04],
        [radius, height * 0.94],
        [radius * 1.08, height],
      ]),
    [height, radius]
  );
  const liquidLevel = Math.max(height * 0.1, height * fillFraction);
  const liquidPoints = useMemo(
    () =>
      latheProfile([
        [0.001, height * 0.03],
        [radius * 0.92, height * 0.03],
        ...liquidMeniscus(radius * 0.92, liquidLevel),
        [0.001, liquidLevel],
      ]),
    [height, liquidLevel, radius]
  );
  const labelTex = useMemo(
    () =>
      createPrintedLabelTexture({
        accentColor,
        badge,
        subtitle,
        title,
      }),
    [accentColor, badge, subtitle, title]
  );
  useEffect(() => () => labelTex?.dispose(), [labelTex]);

  return (
    <group position={position}>
      <mesh>
        <latheGeometry args={[liquidPoints, 36]} />
        <LiquidMaterial color={liquidColor} opacity={0.62} />
      </mesh>
      <mesh castShadow renderOrder={2}>
        <latheGeometry args={[glassPoints, 40]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.28} />
      </mesh>
      {labelTex === null ? null : (
        <mesh
          position={[0, height * 0.46, 0]}
          rotation={[0, -Math.PI * 0.45, 0]}
        >
          <cylinderGeometry
            args={[
              radius * 1.015,
              radius * 1.015,
              height * 0.38,
              24,
              1,
              true,
              0,
              Math.PI * 0.9,
            ]}
          />
          <meshStandardMaterial
            map={labelTex}
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.82}
          />
        </mesh>
      )}
    </group>
  );
}

/** Engraved antique brass nameplate plaque for museum/botanical specimens. */
export function BrassPlaque({
  highlight = false,
  position = [0, 0, 0],
  rotation = [-0.42, 0, 0],
  subtitle,
  title,
}: {
  readonly highlight?: boolean;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly subtitle: string;
  readonly title: string;
}) {
  const tex = useMemo(
    () =>
      createPrintedLabelTexture({
        accentColor: highlight
          ? BOTANY_COLORS.brassHighlight
          : BOTANY_COLORS.brassDark,
        background: highlight
          ? BOTANY_COLORS.brassHighlight
          : BOTANY_COLORS.brassGold,
        badge: subtitle,
        inkColor: BOTANY_COLORS.labelInk,
        subtitle: "",
        title,
      }),
    [highlight, subtitle, title]
  );
  useEffect(() => () => tex?.dispose(), [tex]);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.42, 0.14, 0.018]} />
        <MetalMaterial
          color={
            highlight ? BOTANY_COLORS.brassHighlight : BOTANY_COLORS.brassGold
          }
          roughness={0.32}
        />
      </mesh>
      {tex === null ? null : (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[0.39, 0.12]} />
          <meshStandardMaterial map={tex} metalness={0.35} roughness={0.42} />
        </mesh>
      )}
    </group>
  );
}

/** Graduated boxwood botanical scale ruler with printed centimetre ticks. */
export function GraduatedRuler({
  height = 1.2,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 0.085,
}: {
  readonly height?: number;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly width?: number;
}) {
  const tex = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.fillStyle = BOTANY_COLORS.woodRule;
    ctx.fillRect(0, 0, 128, 512);
    ctx.strokeStyle = BOTANY_COLORS.labelInk;
    ctx.fillStyle = BOTANY_COLORS.labelInk;
    ctx.font = "700 20px ui-monospace, monospace";
    for (let i = 0; i <= 40; i += 1) {
      const y = 496 - i * 12;
      const major = i % 5 === 0;
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(major ? 56 : 30, y);
      ctx.stroke();
      if (major && i > 0) {
        ctx.fillText(`${i}`, 64, y + 7);
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => tex?.dispose(), [tex]);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.016]} />
        <meshStandardMaterial color={BOTANY_COLORS.woodRule} roughness={0.68} />
      </mesh>
      {tex === null ? null : (
        <mesh position={[0, 0, 0.0085]}>
          <planeGeometry args={[width * 0.96, height * 0.96]} />
          <meshStandardMaterial map={tex} roughness={0.65} />
        </mesh>
      )}
    </group>
  );
}
