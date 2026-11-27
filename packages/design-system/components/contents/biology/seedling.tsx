import { leafSurface } from "@repo/design-system/components/contents/biology/leaf";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  DoubleSide,
  Float32BufferAttribute,
  RepeatWrapping,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Builds a UV-mapped curved botanical leaf geometry from `leafSurface`. */
function useLeafBladeGeometry(
  width = 0.54,
  droop = 0.14,
  rows = 16,
  columns = 10
) {
  const geometry = useMemo(() => {
    const surface = leafSurface({ columns, droop, length: 1, rows, width });
    const geo = new BufferGeometry();
    geo.setAttribute(
      "position",
      new Float32BufferAttribute(surface.positions, 3)
    );
    const uvs = Arr.flatMap(Arr.range(0, rows), (row) => {
      const u = row / rows;
      return Arr.flatMap(Arr.range(0, columns), (col) => [u, col / columns]);
    });
    geo.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
    geo.setIndex(surface.indices);
    geo.computeVertexNormals();
    return geo;
  }, [columns, droop, rows, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Procedural veined botanical leaf albedo + bump maps supporting deficiency patterns. */
function createLeafTexturePair({
  baseColor,
  edgeColor,
  interveinalColor,
  veinColor,
}: {
  readonly baseColor: string;
  readonly edgeColor?: string | undefined;
  readonly interveinalColor?: string | undefined;
  readonly veinColor: string;
}): { readonly bump: CanvasTexture; readonly map: CanvasTexture } | null {
  if (typeof document === "undefined") {
    return null;
  }
  const size = 256;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext("2d");
  if (!(ctx && bctx)) {
    return null;
  }

  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, baseColor);
  grad.addColorStop(0.65, interveinalColor ?? baseColor);
  grad.addColorStop(1, edgeColor ?? baseColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (edgeColor !== undefined) {
    const topEdge = ctx.createLinearGradient(0, 0, 0, size * 0.24);
    topEdge.addColorStop(0, edgeColor);
    topEdge.addColorStop(1, "transparent");
    ctx.fillStyle = topEdge;
    ctx.fillRect(0, 0, size, size * 0.24);

    const botEdge = ctx.createLinearGradient(0, size * 0.76, 0, size);
    botEdge.addColorStop(0, "transparent");
    botEdge.addColorStop(1, edgeColor);
    ctx.fillStyle = botEdge;
    ctx.fillRect(0, size * 0.76, size, size * 0.24);
  }

  bctx.fillStyle = BOTANY_COLORS.heavyMetal;
  bctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = veinColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size * 0.96, size / 2);
  ctx.stroke();

  bctx.strokeStyle = getColor("WHITE");
  bctx.lineWidth = 6;
  bctx.beginPath();
  bctx.moveTo(0, size / 2);
  bctx.lineTo(size * 0.96, size / 2);
  bctx.stroke();

  for (const idx of Arr.range(1, 9)) {
    const x0 = idx * 24;
    const span = Math.sin((idx / 10) * Math.PI) * 108;
    for (const side of [-1, 1] as const) {
      ctx.strokeStyle = veinColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x0, size / 2);
      ctx.quadraticCurveTo(
        x0 + 20,
        size / 2 + side * span * 0.55,
        Math.min(size - 4, x0 + 46),
        size / 2 + side * span
      );
      ctx.stroke();

      bctx.strokeStyle = BOTANY_COLORS.heavyMetalGlint;
      bctx.lineWidth = 2.6;
      bctx.beginPath();
      bctx.moveTo(x0, size / 2);
      bctx.quadraticCurveTo(
        x0 + 20,
        size / 2 + side * span * 0.55,
        Math.min(size - 4, x0 + 46),
        size / 2 + side * span
      );
      bctx.stroke();
    }
  }

  const map = new CanvasTexture(colorCanvas);
  map.colorSpace = SRGBColorSpace;
  map.needsUpdate = true;

  const bump = new CanvasTexture(bumpCanvas);
  bump.needsUpdate = true;
  return { bump, map };
}

/** Procedural granular organic peat-soil albedo + bump texture. */
export function createSoilTexture(
  base = BOTANY_COLORS.humusDark,
  speckA = BOTANY_COLORS.soilDark,
  speckB = BOTANY_COLORS.soilSubsoil
): CanvasTexture | null {
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
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i += 1) {
    const x = Math.floor(hashUnit(i, 1) * 256);
    const y = Math.floor(hashUnit(i, 2) * 256);
    const r = 1 + Math.floor(hashUnit(i, 3) * 3.5);
    ctx.fillStyle = i % 3 === 0 ? speckB : speckA;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

/** Single sculpted curved veined botanical leaf with curved petiole stem. */
export function BotanicalLeaf({
  baseColor = BOTANY_COLORS.healthyLeafDeep,
  droop = 0.16,
  edgeColor,
  interveinalColor,
  length = 0.36,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  veinColor = BOTANY_COLORS.healthyLeafVein,
  width = 0.56,
}: {
  readonly baseColor?: string;
  readonly droop?: number;
  readonly edgeColor?: string | undefined;
  readonly interveinalColor?: string | undefined;
  readonly length?: number;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly veinColor?: string;
  readonly width?: number;
}) {
  const blade = useLeafBladeGeometry(width, droop);
  const maps = useMemo(
    () =>
      createLeafTexturePair({
        baseColor,
        edgeColor,
        interveinalColor,
        veinColor,
      }),
    [baseColor, edgeColor, interveinalColor, veinColor]
  );
  useEffect(
    () => () => {
      maps?.map.dispose();
      maps?.bump.dispose();
    },
    [maps]
  );
  const petiole = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(length * 0.08, length * 0.02, 0),
        new Vector3(length * 0.15, 0, 0),
      ]),
    [length]
  );

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <tubeGeometry
          args={[petiole, 8, Math.max(0.004, length * 0.022), 6, false]}
        />
        <meshStandardMaterial
          color={BOTANY_COLORS.stemGreen}
          roughness={0.62}
        />
      </mesh>
      <mesh
        castShadow
        geometry={blade}
        position={[length * 0.14, 0, 0]}
        receiveShadow
        scale={length}
      >
        <meshPhysicalMaterial
          bumpMap={maps?.bump ?? null}
          bumpScale={0.012}
          clearcoat={0.28}
          clearcoatRoughness={0.36}
          map={maps?.map ?? null}
          roughness={0.46}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Procedural branching fibrous root network built from curved tubes. */
export function FibrousRoots({
  color = BOTANY_COLORS.rootIvory,
  count = 9,
  depth = 0.42,
  position = [0, 0, 0],
  seed = 1,
  spread = 0.22,
}: {
  readonly color?: string;
  readonly count?: number;
  readonly depth?: number;
  readonly position?: readonly [number, number, number];
  readonly seed?: number;
  readonly spread?: number;
}) {
  const geometry = useMemo(() => {
    const parts = Arr.flatMap(Arr.range(0, count - 1), (i) => {
      const ang = (i / count) * Math.PI * 2 + hashUnit(seed + i, 1) * 0.55;
      const reach = spread * (0.45 + hashUnit(seed + i, 2) * 0.65);
      const len = depth * (0.62 + hashUnit(seed + i, 3) * 0.42);
      const midX = Math.cos(ang) * reach * 0.55;
      const midZ = Math.sin(ang) * reach * 0.55;
      const endX = Math.cos(ang + 0.25) * reach;
      const endZ = Math.sin(ang + 0.25) * reach;
      const curve = new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(midX, -len * 0.42, midZ),
        new Vector3(endX, -len, endZ),
      ]);
      const main = new TubeGeometry(curve, 12, 0.0085, 6, false).toNonIndexed();
      const subOrigin = curve.getPoint(0.48);
      const subAng = ang + (i % 2 === 0 ? 0.6 : -0.6);
      const subCurve = new CatmullRomCurve3([
        subOrigin,
        subOrigin
          .clone()
          .add(
            new Vector3(
              Math.cos(subAng) * reach * 0.38,
              -len * 0.28,
              Math.sin(subAng) * reach * 0.38
            )
          ),
      ]);
      const sub = new TubeGeometry(
        subCurve,
        8,
        0.0045,
        5,
        false
      ).toNonIndexed();
      return [main, sub];
    });
    return mergeGeometries(parts);
  }, [count, depth, seed, spread]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh castShadow geometry={geometry} position={position}>
      <meshStandardMaterial color={color} roughness={0.74} />
    </mesh>
  );
}
