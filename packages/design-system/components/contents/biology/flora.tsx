import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import type { Outline } from "@repo/design-system/components/three/flora/blade";
import {
  bladeMesh,
  veinAt,
} from "@repo/design-system/components/three/flora/blade";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  MeshPhysicalMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const UP = new Vector3(0, 1, 0);

/** Converts any geometry into non-indexed vertex-colored form safe for merging. */
export function colorizeGeometry(
  raw: BufferGeometry,
  base: Color,
  tip?: Color,
  heightSpan = 1
): BufferGeometry {
  const geom = raw.index === null ? raw : raw.toNonIndexed();
  geom.deleteAttribute("uv");
  if (geom.getAttribute("normal") === undefined) {
    geom.computeVertexNormals();
  }
  const pos = geom.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    if (tip === undefined) {
      c.copy(base);
    } else {
      const t = Math.min(1, Math.max(0, y / Math.max(0.001, heightSpan)));
      c.copy(base).lerp(tip, t);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute("color", new BufferAttribute(colors, 3));
  return geom;
}

/** The golden angle, by which each next leaf turns about its stem. */
export const TURN = Math.PI * (3 - Math.sqrt(5));

/**
 * One veined blade of the flora engine, set in the world and coloured vertex
 * by vertex: darker at its base, lighter to its tip and along every vein, and
 * `mark` may paint what one species carries, such as the pale chevron of a
 * clover leaflet.
 */
export function placeBlade({
  base,
  columns = 6,
  droop,
  heading,
  length,
  mark,
  origin,
  outline,
  pitch,
  rows,
  tip,
  width,
}: {
  readonly base: Color;
  readonly columns?: number;
  readonly droop: number;
  readonly heading: number;
  readonly length: number;
  readonly mark?: {
    readonly at: (along: number, across: number) => number;
    readonly color: Color;
  };
  readonly origin: Vector3;
  readonly outline: Outline;
  readonly pitch: number;
  readonly rows: number;
  readonly tip: Color;
  readonly width: number;
}): BufferGeometry {
  const mesh = bladeMesh({
    arch: droop * 0.7,
    columns,
    fold: 0.3,
    length,
    outline,
    relief: 0.02,
    rows,
    teeth: 0,
    veins: 6,
    wave: 0.1,
    width,
  });
  const along = new Vector3(
    Math.cos(pitch) * Math.cos(heading),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(heading)
  );
  const side = new Vector3().crossVectors(along, UP);
  if (side.lengthSq() < 1e-4) {
    side.set(1, 0, 0);
  }
  side.normalize();
  const face = new Vector3().crossVectors(side, along).normalize();
  const turn = new Matrix4().makeBasis(along, face, side).setPosition(origin);
  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(mesh.positions, 3));
  geom.setAttribute("normal", new Float32BufferAttribute(mesh.normals, 3));
  geom.setIndex([...mesh.indices]);
  geom.applyMatrix4(turn);
  const colors = new Float32Array((mesh.uvs.length / 2) * 3);
  const shade = new Color();
  for (let i = 0; i < mesh.uvs.length / 2; i += 1) {
    const across = Number(mesh.uvs[i * 2]) * 2 - 1;
    const run = Number(mesh.uvs[i * 2 + 1]);
    const vein = veinAt(run, across, 6);
    shade.copy(base).lerp(tip, Math.min(1, run * 0.8 + vein * 0.35));
    if (mark !== undefined) {
      shade.lerp(mark.color, mark.at(run, across));
    }
    shade.multiplyScalar(0.82 + 0.18 * (1 - across * across));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geom.setAttribute("color", new BufferAttribute(colors, 3));
  return geom.toNonIndexed();
}

/** Builds one folded, arching botanical leaf blade or frond segment. */
export function leafBlade(
  origin: Vector3,
  heading: number,
  pitch: number,
  length: number,
  width: number,
  droop: number,
  segments: number,
  baseColor: Color,
  tipColor: Color
): BufferGeometry {
  const dir = new Vector3(
    Math.cos(pitch) * Math.cos(heading),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(heading)
  );
  const along = (s: number) =>
    origin
      .clone()
      .addScaledVector(dir, length * s)
      .addScaledVector(UP, -droop * length * s * s);
  const rings = Arr.map(Arr.range(0, segments), (step) => {
    const s = step / segments;
    const p = along(s);
    const tangent = along(Math.min(1, s + 0.02))
      .sub(along(Math.max(0, s - 0.02)))
      .normalize();
    const side = new Vector3().crossVectors(tangent, UP);
    if (side.lengthSq() < 1e-4) {
      side.set(1, 0, 0);
    } else {
      side.normalize();
    }
    const face = new Vector3().crossVectors(side, tangent).normalize();
    const profile = Math.sin(Math.min(1, s) * Math.PI) ** 0.72;
    const half = width * 0.5 * Math.max(0.06, profile);
    const fold = half * 0.28;
    const shade = baseColor.clone().lerp(tipColor, s);
    return [
      [
        p.clone().addScaledVector(side, -half).addScaledVector(face, fold),
        shade,
      ],
      [p, shade.clone().lerp(tipColor, 0.22)],
      [
        p.clone().addScaledVector(side, half).addScaledVector(face, fold),
        shade,
      ],
    ] as const;
  });
  const pts = Arr.flatten(rings);
  const geom = new BufferGeometry();
  geom.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array(Arr.flatMap(pts, ([p]) => [p.x, p.y, p.z])),
      3
    )
  );
  geom.setAttribute(
    "color",
    new BufferAttribute(
      new Float32Array(Arr.flatMap(pts, ([, c]) => [c.r, c.g, c.b])),
      3
    )
  );
  geom.setIndex(
    Arr.flatMap(Arr.range(0, segments - 1), (step) => {
      const a = step * 3;
      const b = a + 3;
      return [
        a,
        b,
        a + 1,
        a + 1,
        b,
        b + 1,
        a + 1,
        b + 1,
        a + 2,
        a + 2,
        b + 1,
        b + 2,
      ];
    })
  );
  geom.computeVertexNormals();
  return geom.toNonIndexed();
}

/** Builds a realistic arching grass tuft of curved vertex-colored blades. */
export function useGrassClump(seed = 1, bladeCount = 14) {
  const geometry = useMemo(() => {
    const base = new Color(BIOME_COLORS.canopyDeep);
    const tip = new Color(BIOME_COLORS.grassTip);
    const parts = Arr.map(Arr.range(0, bladeCount - 1), (i) => {
      const angle =
        (i / bladeCount) * Math.PI * 2 + hashUnit(seed + i, 3) * 0.5;
      const r = 0.03 + hashUnit(seed + i, 5) * 0.09;
      return leafBlade(
        new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
        angle,
        0.72 + hashUnit(seed + i, 11) * 0.48,
        0.22 + hashUnit(seed + i, 13) * 0.14,
        0.026 + hashUnit(seed + i, 17) * 0.012,
        0.48 + hashUnit(seed + i, 19) * 0.28,
        6,
        base.clone().multiplyScalar(0.85 + hashUnit(seed + i, 7) * 0.3),
        tip.clone().multiplyScalar(0.85 + hashUnit(seed + i, 9) * 0.25)
      );
    });
    return mergeGeometries(parts);
  }, [bladeCount, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds a lush trifoliate clover rosette with stems, heart leaflets, and blooms. */
export function useCloverCluster(seed = 2) {
  const geometry = useMemo(() => {
    const stemCol = new Color(BIOME_COLORS.canopyEmerald);
    const leafBase = new Color(BIOME_COLORS.cloverGreen);
    const leafTip = new Color(BIOME_COLORS.canopySun);
    const bloomCol = new Color(BIOME_COLORS.cloverFlower);
    const parts = Arr.flatMap(Arr.range(0, 8), (i) => {
      const ang = (i / 9) * Math.PI * 2 + hashUnit(seed + i, 1) * 0.6;
      const rad = 0.04 + hashUnit(seed + i, 2) * 0.16;
      const h = 0.09 + hashUnit(seed + i, 3) * 0.08;
      const bx = Math.cos(ang) * rad;
      const bz = Math.sin(ang) * rad;
      const stem = new CylinderGeometry(0.004, 0.006, h, 5, 1, true);
      stem.translate(bx, h * 0.5, bz);
      const leaflets = Arr.map(Arr.range(0, 2), (l) =>
        leafBlade(
          new Vector3(bx, h, bz),
          ang + (l * Math.PI * 2) / 3,
          0.18 + hashUnit(seed + i * 3 + l, 5) * 0.16,
          0.095,
          0.072,
          0.32,
          4,
          leafBase,
          leafTip
        )
      );
      const bloom =
        i % 3 === 0
          ? (() => {
              const f = new SphereGeometry(0.026, 8, 6);
              f.scale(1, 0.82, 1);
              f.translate(bx, h + 0.045, bz);
              return [colorizeGeometry(f, bloomCol)];
            })()
          : [];
      return [colorizeGeometry(stem, stemCol), ...leaflets, ...bloom];
    });
    return mergeGeometries(parts);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds a radial woodland fern rosette with arching pinnate fronds. */
export function useFernRosette(seed = 3) {
  const geometry = useMemo(() => {
    const rachisCol = new Color(BIOME_COLORS.canopyDeep);
    const pinnaBase = new Color(BIOME_COLORS.fernTeal);
    const pinnaTip = new Color(BIOME_COLORS.canopySun);
    const parts = Arr.flatMap(Arr.range(0, 7), (f) => {
      const yaw = (f / 8) * Math.PI * 2 + hashUnit(seed + f, 2) * 0.35;
      const len = 0.34 + hashUnit(seed + f, 5) * 0.14;
      const rise = 0.24 + hashUnit(seed + f, 7) * 0.12;
      const dirX = Math.cos(yaw);
      const dirZ = Math.sin(yaw);
      const curve = new CatmullRomCurve3([
        new Vector3(0, 0.01, 0),
        new Vector3(dirX * len * 0.42, rise * 0.85, dirZ * len * 0.42),
        new Vector3(dirX * len * 0.78, rise * 0.96, dirZ * len * 0.78),
        new Vector3(dirX * len, rise * 0.42, dirZ * len),
      ]);
      const pinnae = Arr.flatMap(Arr.range(1, 6), (p) => {
        const t = p / 7;
        const pt = curve.getPoint(t);
        const span = (1 - Math.abs(t - 0.42)) * 0.11;
        return Arr.map([-1, 1] as const, (side) =>
          leafBlade(
            pt,
            yaw + side * 1.15,
            0.08,
            span,
            0.032,
            0.25,
            3,
            pinnaBase,
            pinnaTip
          )
        );
      });
      return [
        colorizeGeometry(
          new TubeGeometry(curve, 12, 0.006, 5, false),
          rachisCol
        ),
        ...pinnae,
      ];
    });
    return mergeGeometries(parts);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds a velvety undulating bryophyte moss cushion with golden sporophytes. */
export function useMossCushion(seed = 4) {
  const geometry = useMemo(() => {
    const deep = new Color(BIOME_COLORS.canopyDeep);
    const velvet = new Color(BIOME_COLORS.mossOlive);
    const bright = new Color(BIOME_COLORS.lichenLime);
    const sporeCol = new Color(BIOME_COLORS.heatAmber);
    const mounds = Arr.map(Arr.range(0, 6), (m) => {
      const ang = (m / 7) * Math.PI * 2;
      const dist = m === 0 ? 0 : 0.11 + hashUnit(seed + m, 3) * 0.06;
      const rad = m === 0 ? 0.16 : 0.1 + hashUnit(seed + m, 5) * 0.04;
      const mound = new SphereGeometry(
        rad,
        16,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.55
      );
      const pos = mound.getAttribute("position");
      for (let i = 0; i < pos.count; i += 1) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const bump =
          0.86 + 0.28 * valueNoise(vx * 24 + seed + m, vz * 24 + vy * 12, 32);
        pos.setXYZ(i, vx * bump, vy * 0.58 * bump, vz * bump);
      }
      mound.translate(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      mound.computeVertexNormals();
      return colorizeGeometry(mound, deep, m % 2 === 0 ? velvet : bright, 0.1);
    });
    const spores = Arr.flatMap(Arr.range(0, 5), (s) => {
      const ang = (s / 6) * Math.PI * 2 + 0.4;
      const dist = 0.04 + hashUnit(seed + s, 9) * 0.11;
      const h = 0.12 + hashUnit(seed + s, 11) * 0.05;
      const sx = Math.cos(ang) * dist;
      const sz = Math.sin(ang) * dist;
      const seta = new CylinderGeometry(0.0025, 0.003, h, 4, 1, true);
      seta.translate(sx, h * 0.5 + 0.03, sz);
      const cap = new SphereGeometry(0.011, 7, 5);
      cap.scale(0.8, 1.4, 0.8);
      cap.translate(sx, h + 0.035, sz);
      return [
        colorizeGeometry(seta, velvet, sporeCol, h + 0.04),
        colorizeGeometry(cap, sporeCol),
      ];
    });
    return mergeGeometries([...mounds, ...spores]);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds a ruffled foliose pioneer lichen rosette hugging bare rock. */
export function useLichenPatch(seed = 5) {
  const geometry = useMemo(() => {
    const edge = new Color(BIOME_COLORS.lichenLime);
    const center = new Color(BIOME_COLORS.lichenSage);
    const parts = Arr.map(Arr.range(0, 3), (k) => {
      const ang = (k / 4) * Math.PI * 2 + hashUnit(seed + k, 2);
      const dist = k === 0 ? 0 : 0.12;
      const dome = new SphereGeometry(
        0.14,
        20,
        10,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.48
      );
      const pos = dome.getAttribute("position");
      for (let i = 0; i < pos.count; i += 1) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const lobe = 0.8 + 0.28 * Math.sin(Math.atan2(vz, vx) * 7 + k * 1.4);
        pos.setXYZ(i, vx * lobe, vy * 0.16, vz * lobe);
      }
      dome.translate(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      dome.computeVertexNormals();
      return colorizeGeometry(dome, center, edge, 0.03);
    });
    return mergeGeometries(parts);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

const MUSHROOM_SPECS = [
  { h: 0.24, r: 0.11, x: 0, z: 0 },
  { h: 0.17, r: 0.082, x: 0.12, z: 0.06 },
  { h: 0.14, r: 0.07, x: -0.11, z: 0.08 },
  { h: 0.19, r: 0.09, x: -0.05, z: -0.11 },
  { h: 0.11, r: 0.055, x: 0.08, z: -0.09 },
] as const;

/** Builds a cluster of sculpted woodland decomposer mushrooms (stipes + domed caps). */
export function useMushroomCluster(seed = 9) {
  const geometry = useMemo(() => {
    const stipeCol = new Color(BIOME_COLORS.mushroomCream);
    const capCol = new Color(BIOME_COLORS.mushroomCap);
    const capDark = new Color(BIOME_COLORS.barkWarm);
    const parts = Arr.flatMap(MUSHROOM_SPECS, (sp, idx) => {
      const leanX = (hashUnit(seed + idx, 3) - 0.5) * 0.04;
      const leanZ = (hashUnit(seed + idx, 5) - 0.5) * 0.04;
      const stipeCurve = new CatmullRomCurve3([
        new Vector3(sp.x, 0, sp.z),
        new Vector3(sp.x + leanX * 0.6, sp.h * 0.5, sp.z + leanZ * 0.6),
        new Vector3(sp.x + leanX, sp.h, sp.z + leanZ),
      ]);
      const profile = [
        new Vector2(0.001, sp.r * 0.62),
        new Vector2(sp.r * 0.45, sp.r * 0.55),
        new Vector2(sp.r * 0.88, sp.r * 0.25),
        new Vector2(sp.r, 0),
        new Vector2(sp.r * 0.72, -sp.r * 0.06),
        new Vector2(sp.r * 0.2, 0.01),
      ];
      const cap = new LatheGeometry(profile, 22);
      cap.translate(sp.x + leanX, sp.h - 0.01, sp.z + leanZ);
      return [
        colorizeGeometry(
          new TubeGeometry(stipeCurve, 10, sp.r * 0.22, 8, false),
          stipeCol
        ),
        colorizeGeometry(cap, capDark, capCol, sp.h + sp.r * 0.6),
      ];
    });
    return mergeGeometries(parts);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Shared waxy botanical leaf PBR material with soft cuticle sheen. */
export function useFoliageMaterial() {
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.2,
        clearcoatRoughness: 0.45,
        metalness: 0,
        roughness: 0.54,
        sheen: 0.42,
        sheenColor: new Color(BIOME_COLORS.leafSheen),
        sheenRoughness: 0.55,
        side: DoubleSide,
        vertexColors: true,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
