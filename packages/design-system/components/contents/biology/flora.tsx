import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import type { Outline } from "@repo/design-system/components/three/flora/blade";
import {
  bladeMesh,
  veinAt,
} from "@repo/design-system/components/three/flora/blade";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
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

/** Builds one folded, arching, veined botanical leaf blade or frond segment. */
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
  return placeBlade({
    base: baseColor,
    droop,
    heading,
    length,
    origin,
    outline: width / length < 0.2 ? "linear" : "lanceolate",
    pitch,
    rows: Math.max(8, segments * 2),
    tip: tipColor,
    width,
  });
}

/** Builds a realistic arching grass tuft of keeled, veined blades. */
export function useGrassClump(seed = 1, bladeCount = 14) {
  const geometry = useMemo(() => {
    const base = new Color(FLORA_COLORS.grassDeep);
    const tip = new Color(FLORA_COLORS.grassTip);
    const dry = new Color(FLORA_COLORS.grassDry);
    const parts = Arr.map(Arr.range(0, bladeCount * 3 - 1), (i) => {
      const angle = i * TURN + hashUnit(seed + i, 3) * 0.5;
      const r = 0.012 + hashUnit(seed + i, 5) * 0.085;
      const length = 0.16 + hashUnit(seed + i, 13) * 0.2;
      return placeBlade({
        base: base.clone().multiplyScalar(0.8 + hashUnit(seed + i, 7) * 0.35),
        columns: 2,
        droop: 0.35 + hashUnit(seed + i, 19) * 0.5,
        heading: angle,
        length,
        origin: new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
        outline: "linear",
        pitch: 0.85 + hashUnit(seed + i, 11) * 0.6,
        rows: 8,
        tip: i % 7 === 0 ? dry : tip,
        width: 0.014 + hashUnit(seed + i, 17) * 0.008,
      });
    });
    return mergeGeometries(parts);
  }, [bladeCount, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds a woodland fern: arching fronds of pinnae that shorten to the tip, and a coiled fiddlehead. */
export function useFernRosette(seed = 3) {
  const geometry = useMemo(() => {
    const rachisCol = new Color(FLORA_COLORS.stemGreen);
    const pinnaBase = new Color(FLORA_COLORS.fernDeep);
    const pinnaTip = new Color(FLORA_COLORS.fernTip);
    const fronds = Arr.flatMap(Arr.range(0, 8), (f) => {
      const yaw = f * TURN + hashUnit(seed + f, 2) * 0.35;
      const len = 0.3 + hashUnit(seed + f, 5) * 0.16;
      const rise = 0.2 + hashUnit(seed + f, 7) * 0.12;
      const dirX = Math.cos(yaw);
      const dirZ = Math.sin(yaw);
      const curve = new CatmullRomCurve3([
        new Vector3(0, 0.005, 0),
        new Vector3(dirX * len * 0.3, rise * 0.8, dirZ * len * 0.3),
        new Vector3(dirX * len * 0.72, rise, dirZ * len * 0.72),
        new Vector3(dirX * len, rise * 0.55, dirZ * len),
      ]);
      const pinnae = Arr.flatMap(Arr.range(2, 19), (p) => {
        const t = p / 20;
        const pt = curve.getPoint(t);
        const span = len * 0.34 * Math.sin(Math.PI * t ** 0.7) ** 0.8;
        return Arr.map([-1, 1] as const, (side) =>
          placeBlade({
            base: pinnaBase,
            columns: 4,
            droop: 0.3,
            heading: yaw + side * 1.22,
            length: span,
            origin: pt,
            outline: "lanceolate",
            pitch: 0.1 - t * 0.2,
            rows: 6,
            tip: pinnaTip,
            width: span * 0.3,
          })
        );
      });
      return [
        colorizeGeometry(
          new TubeGeometry(curve, 20, 0.0045, 5, false),
          rachisCol
        ),
        ...pinnae,
      ];
    });
    const crozier = new CatmullRomCurve3(
      Arr.makeBy(22, (step) => {
        const t = step / 21;
        const coil = Math.max(0, t - 0.5) * 2;
        const wind = coil * Math.PI * 3.2;
        const reach = 0.03 * (1 - coil * 0.75);
        return new Vector3(
          0.02 + Math.sin(wind) * reach * coil,
          t * 0.13 + (1 - Math.cos(wind)) * reach * coil,
          0.015
        );
      })
    );
    return mergeGeometries([
      ...fronds,
      colorizeGeometry(
        new TubeGeometry(crozier, 40, 0.006, 6, false),
        rachisCol,
        pinnaTip,
        0.16
      ),
    ]);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds a moss cushion: a low mound bristling with hundreds of tiny leafy shoots and thin stalked capsules. */
export function useMossCushion(seed = 4) {
  const geometry = useMemo(() => {
    const deep = new Color(FLORA_COLORS.mossDeep);
    const bright = new Color(FLORA_COLORS.mossTip);
    const seta = new Color(FLORA_COLORS.stemRed);
    const capsule = new Color(FLORA_COLORS.seedCoat);
    const mounds = Arr.map(Arr.range(0, 6), (m) => {
      const ang = (m / 7) * Math.PI * 2;
      const dist = m === 0 ? 0 : 0.11 + hashUnit(seed + m, 3) * 0.06;
      const rad = m === 0 ? 0.16 : 0.1 + hashUnit(seed + m, 5) * 0.04;
      return { rad, x: Math.cos(ang) * dist, z: Math.sin(ang) * dist };
    });
    const cushions = Arr.map(mounds, (mound, m) => {
      const dome = new SphereGeometry(
        mound.rad,
        16,
        10,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.5
      );
      dome.scale(1, 0.5, 1);
      dome.translate(mound.x, 0, mound.z);
      return colorizeGeometry(dome, deep, m % 2 === 0 ? deep : bright, 0.3);
    });
    const shoots = Arr.flatMap(mounds, (mound, m) =>
      Arr.map(Arr.range(0, 139), (s) => {
        const turn = s * TURN;
        const far = Math.sqrt((s + 0.5) / 140);
        const lift = Math.sqrt(Math.max(0, 1 - far * far)) * 0.5;
        return placeBlade({
          base: deep,
          columns: 2,
          droop: 0.2,
          heading: turn + hashUnit(seed + m * 150 + s, 2) * 2,
          length: 0.018 + hashUnit(seed + m * 150 + s, 4) * 0.014,
          origin: new Vector3(
            mound.x + Math.cos(turn) * far * mound.rad,
            lift * mound.rad * 0.96,
            mound.z + Math.sin(turn) * far * mound.rad
          ),
          outline: "lanceolate",
          pitch: 1.35 - far * 0.9,
          rows: 4,
          tip: bright,
          width: 0.006,
        });
      })
    );
    const spores = Arr.flatMap(Arr.range(0, 11), (s) => {
      const ang = s * TURN;
      const dist = 0.03 + hashUnit(seed + s, 9) * 0.13;
      const h = 0.07 + hashUnit(seed + s, 11) * 0.05;
      const sx = Math.cos(ang) * dist;
      const sz = Math.sin(ang) * dist;
      const stalk = new CylinderGeometry(0.0009, 0.0012, h, 4, 1, true);
      stalk.translate(sx, h * 0.5 + 0.05, sz);
      const cap = new SphereGeometry(0.005, 7, 6);
      cap.scale(0.75, 1.9, 0.75);
      cap.rotateZ(0.5);
      cap.translate(sx + 0.003, h + 0.055, sz);
      return [colorizeGeometry(stalk, seta), colorizeGeometry(cap, capsule)];
    });
    return mergeGeometries([...cushions, ...shoots, ...spores]);
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
