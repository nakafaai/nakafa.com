import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  DoubleSide,
  LatheGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";

/**
 * Procedural rich walnut wood grain CanvasTexture for Mendel's heirloom
 * botanical Punnett specimen trays.
 */
export function useWalnutTexture() {
  const texture = useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.fillStyle = GENETICS_COLORS.walnutWarm;
    ctx.fillRect(0, 0, 512, 512);

    for (const row of Arr.range(0, 255)) {
      const y = row * 2;
      const wave = Math.sin(row * 0.14) * 14 + Math.cos(row * 0.04) * 22;
      ctx.strokeStyle =
        row % 3 === 0
          ? GENETICS_COLORS.walnutDark
          : GENETICS_COLORS.walnutGrain;
      ctx.globalAlpha = 0.14 + (row % 5) * 0.04;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + wave, 340, y - wave * 0.8, 512, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, []);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

function paintPeaCreases(ctx: CanvasRenderingContext2D, deep: string) {
  ctx.strokeStyle = deep;
  ctx.globalAlpha = 0.48;
  ctx.lineWidth = 3;
  for (const i of Arr.range(0, 28)) {
    const sx = hashUnit(i + 41, 2) * 256;
    const sy = hashUnit(i + 41, 5) * 256;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 18, sy - 10, sx + 34, sy + 14);
    ctx.stroke();
  }
}

function paintPeaMottle(
  ctx: CanvasRenderingContext2D,
  base: string,
  deep: string,
  isWrinkled: boolean
) {
  const count = isWrinkled ? 110 : 55;
  const minR = isWrinkled ? 14 : 20;
  ctx.globalAlpha = isWrinkled ? 0.34 : 0.16;
  for (const i of Arr.range(0, count)) {
    const cx = hashUnit(i + 17, 3) * 256;
    const cy = hashUnit(i + 17, 7) * 256;
    const r = minR + hashUnit(i + 17, 11) * 24;
    ctx.fillStyle = i % 3 === 0 ? deep : base;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function usePeaTexture(isYellow: boolean, isWrinkled: boolean) {
  const texture = useMemo(() => {
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
    const base = isYellow
      ? GENETICS_COLORS.peaYellowSmooth
      : GENETICS_COLORS.peaGreenSmooth;
    const deep = isYellow
      ? GENETICS_COLORS.peaYellowDeep
      : GENETICS_COLORS.peaGreenDeep;
    const hilum = isYellow
      ? GENETICS_COLORS.peaYellowHilum
      : GENETICS_COLORS.peaGreenHilum;

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    paintPeaMottle(ctx, base, deep, isWrinkled);
    if (isWrinkled) {
      paintPeaCreases(ctx, deep);
    }

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = hilum;
    ctx.beginPath();
    ctx.ellipse(128, 128, 18, 9, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }, [isWrinkled, isYellow]);

  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}

function usePeaGeometry(isWrinkled: boolean, seed: number) {
  const geo = useMemo(() => {
    const sphere = new SphereGeometry(0.118, 40, 30);
    const pos = sphere.getAttribute("position");
    const pt = new Vector3();
    for (const i of Arr.range(0, pos.count - 1)) {
      pt.fromBufferAttribute(pos, i);
      const nx = pt.x / 0.118;
      const ny = pt.y / 0.118;
      const nz = pt.z / 0.118;
      const hilumIndent =
        nz > 0.7 ? -0.06 * Math.exp(-((nx * nx + ny * ny) * 10)) : 0;
      let radial =
        1 +
        hilumIndent +
        0.025 * (valueNoise(nx * 5 + seed, ny * 5 + nz * 4, 32) - 0.5);
      if (isWrinkled) {
        const creaseA = Math.sin(nx * 6.5 + ny * 5.2 + seed) * 0.085;
        const creaseB = Math.cos(nz * 7.2 - nx * 4.8 + seed) * 0.075;
        const dimple =
          0.16 * (valueNoise(nx * 9 + seed, ny * 9 - nz * 7, 32) - 0.5);
        radial += creaseA + creaseB + dimple - 0.04;
      }
      pos.setXYZ(i, pt.x * radial, pt.y * 0.92 * radial, pt.z * radial);
    }
    sphere.computeVertexNormals();
    return sphere;
  }, [isWrinkled, seed]);

  useEffect(() => () => geo.dispose(), [geo]);
  return geo;
}

/**
 * Photorealistic sculpted Pisum sativum pea seed (smooth yellow, smooth green,
 * wrinkled yellow, or wrinkled green) with procedural mottled seed coat.
 */
export function PeaSeed({
  highlighted = true,
  isWrinkled,
  isYellow,
  position,
  scale = 1,
  seed = 1,
}: {
  readonly highlighted?: boolean;
  readonly isWrinkled: boolean;
  readonly isYellow: boolean;
  readonly position: readonly [number, number, number];
  readonly scale?: number;
  readonly seed?: number;
}) {
  const geo = usePeaGeometry(isWrinkled, seed);
  const tex = usePeaTexture(isYellow, isWrinkled);
  const fallbackColor = isYellow
    ? GENETICS_COLORS.peaYellowSmooth
    : GENETICS_COLORS.peaGreenSmooth;

  return (
    <mesh
      castShadow
      geometry={geo}
      position={position}
      receiveShadow
      rotation={[0.22, seed * 0.85, 0.1]}
      scale={scale}
    >
      <meshPhysicalMaterial
        clearcoat={isWrinkled ? 0.14 : 0.42}
        clearcoatRoughness={isWrinkled ? 0.62 : 0.28}
        color={tex === null ? fallbackColor : getColor("WHITE")}
        map={tex}
        opacity={highlighted ? 1 : 0.22}
        roughness={isWrinkled ? 0.74 : 0.34}
        transparent={!highlighted}
      />
    </mesh>
  );
}

/**
 * Open curved botanical pea pod valve resting beside the Mendel tray, showing
 * outer chlorophyll pod skin and seated pea seeds inside the open trough.
 */
export function PeaPodHalf({
  position,
  rotation = [0, 0, 0],
}: {
  readonly position: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
}) {
  const podGeo = useMemo(() => {
    const pts = Arr.map(Arr.range(0, 18), (i) => {
      const t = i / 18;
      const r = Math.sin(t * Math.PI) ** 0.72 * 0.11;
      return new Vector2(Math.max(0.004, r), (t - 0.5) * 0.7);
    });
    const lathe = new LatheGeometry(pts, 28, Math.PI, Math.PI);
    lathe.rotateZ(Math.PI / 2);
    return lathe;
  }, []);

  useEffect(() => () => podGeo.dispose(), [podGeo]);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow geometry={podGeo} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={0.28}
          color={GENETICS_COLORS.podOuter}
          roughness={0.48}
          side={DoubleSide}
        />
      </mesh>
      <PeaSeed
        isWrinkled={false}
        isYellow={false}
        position={[-0.14, 0.02, 0.01]}
        scale={0.58}
        seed={31}
      />
      <PeaSeed
        isWrinkled={false}
        isYellow
        position={[0, 0.025, 0.01]}
        scale={0.58}
        seed={37}
      />
      <PeaSeed
        isWrinkled
        isYellow={false}
        position={[0.14, 0.02, 0.01]}
        scale={0.58}
        seed={43}
      />
    </group>
  );
}
