import {
  buildBandGeometry,
  buildLongBoneGeometry,
} from "@repo/design-system/components/contents/biology/joint/geometry";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  CatmullRomCurve3,
  LatheGeometry,
  MeshPhysicalMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Procedural longitudinal striated skeletal muscle fascicle texture + bump map. */
function createStriatedMuscleMaps(baseHex: string, darkHex: string) {
  const size = 256;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext("2d");

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext("2d");

  if (cCtx !== null && bCtx !== null) {
    cCtx.fillStyle = baseHex;
    cCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = SKELETON_COLORS.regionNeutral;
    bCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 42; i += 1) {
      const x = (i / 42) * size;
      const w = 1.6 + (i % 3) * 0.7;
      cCtx.fillStyle = i % 5 === 0 ? SKELETON_COLORS.tendonSheen : darkHex;
      cCtx.globalAlpha = i % 5 === 0 ? 0.24 : 0.34;
      cCtx.fillRect(x, 0, w, size);

      bCtx.fillStyle =
        i % 5 === 0 ? SKELETON_COLORS.tendonSheen : SKELETON_COLORS.canal;
      bCtx.globalAlpha = 0.6;
      bCtx.fillRect(x, 0, w, size);
    }
    // Fine horizontal sarcomere cross-striation subtle micro-bands.
    cCtx.globalAlpha = 0.08;
    cCtx.fillStyle = darkHex;
    for (let y = 0; y < size; y += 6) {
      cCtx.fillRect(0, y, size, 2);
    }
  }

  const map = new CanvasTexture(colorCanvas);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(2.4, 1);

  const bumpMap = new CanvasTexture(bumpCanvas);
  bumpMap.wrapS = RepeatWrapping;
  bumpMap.wrapT = RepeatWrapping;
  bumpMap.repeat.set(2.4, 1);

  return { bumpMap, map };
}

/** Shared striated skeletal muscle PBR materials (contracting deep crimson vs relaxed rose-red). */
export function useMuscleMaterials() {
  const materials = useMemo(() => {
    const activeMaps = createStriatedMuscleMaps(
      SKELETON_COLORS.muscleContract,
      SKELETON_COLORS.muscleDark
    );
    const relaxMaps = createStriatedMuscleMaps(
      SKELETON_COLORS.muscleRelax,
      SKELETON_COLORS.muscleRelaxDark
    );

    const active = new MeshPhysicalMaterial({
      bumpMap: activeMaps.bumpMap,
      bumpScale: 0.018,
      clearcoat: 0.36,
      clearcoatRoughness: 0.36,
      map: activeMaps.map,
      roughness: 0.48,
      sheen: 0.42,
      sheenColor: SKELETON_COLORS.muscleFiber,
      sheenRoughness: 0.55,
    });
    const relaxed = new MeshPhysicalMaterial({
      bumpMap: relaxMaps.bumpMap,
      bumpScale: 0.014,
      clearcoat: 0.24,
      clearcoatRoughness: 0.48,
      map: relaxMaps.map,
      roughness: 0.56,
      sheen: 0.3,
      sheenColor: SKELETON_COLORS.muscleRelax,
      sheenRoughness: 0.65,
    });
    const tendon = new MeshPhysicalMaterial({
      clearcoat: 0.48,
      clearcoatRoughness: 0.28,
      color: SKELETON_COLORS.tendon,
      roughness: 0.36,
      sheen: 0.5,
      sheenColor: SKELETON_COLORS.tendonSheen,
      sheenRoughness: 0.42,
    });
    const bone = new MeshPhysicalMaterial({
      clearcoat: 0.22,
      clearcoatRoughness: 0.46,
      color: SKELETON_COLORS.bone,
      roughness: 0.46,
      sheen: 0.16,
      sheenColor: SKELETON_COLORS.boneCondyle,
      sheenRoughness: 0.6,
    });
    const boneSoft = new MeshPhysicalMaterial({
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
      color: SKELETON_COLORS.boneSoft,
      roughness: 0.5,
    });

    return {
      active,
      activeMaps,
      bone,
      boneSoft,
      relaxed,
      relaxMaps,
      tendon,
    };
  }, []);

  useEffect(
    () => () => {
      materials.active.dispose();
      materials.relaxed.dispose();
      materials.tendon.dispose();
      materials.bone.dispose();
      materials.boneSoft.dispose();
      materials.activeMaps.map.dispose();
      materials.activeMaps.bumpMap.dispose();
      materials.relaxMaps.map.dispose();
      materials.relaxMaps.bumpMap.dispose();
    },
    [materials]
  );

  return materials;
}

/** Sculpted fusiform skeletal muscle belly with organic longitudinal fiber taper. */
export function buildFusiformBelly(length: number, maxRadius: number) {
  const pts = Arr.map(Arr.range(0, 20), (step) => {
    const t = step / 20;
    const envelope = Math.sin(t * Math.PI) ** 0.72;
    const r = Math.max(0.006, envelope * maxRadius);
    return new Vector2(r, (t - 0.5) * length);
  });
  return new LatheGeometry(pts, 32);
}

/** Sculpted bilobed gastrocnemius calf belly tapering into the Achilles tendon. */
function buildCalfBelly() {
  const geom = new SphereGeometry(1, 32, 24);
  const pos = geom.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);
    const upperFullness = uy > -0.1 ? 1.15 : 0.72 + (uy + 1) * 0.45;
    const midlineGroove =
      1 - 0.14 * Math.exp(-((uz * 4.5) ** 2)) * Math.max(0, uy + 0.3);
    pos.setXYZ(
      i,
      ux * 0.088 * upperFullness,
      uy * 0.24,
      uz * 0.095 * upperFullness * midlineGroove
    );
  }
  geom.computeVertexNormals();
  return geom;
}

/** Sculpted human arm skeleton & muscular attachments (humerus, radius, ulna, olecranon, articulated hand). */
export function useArmGeometries() {
  const geos = useMemo(() => {
    const humerus = buildLongBoneGeometry(0.84, 0.056);
    const radius = buildLongBoneGeometry(0.7, 0.036);
    const ulna = buildLongBoneGeometry(0.74, 0.038);
    const bicepsBelly = buildFusiformBelly(0.56, 0.088);
    const tricepsBelly = buildFusiformBelly(0.58, 0.08);
    const olecranon = buildBandGeometry(
      [
        [-0.08, -0.02, 0],
        [-0.04, -0.05, 0],
        [0.04, -0.045, 0],
      ],
      0.036
    );
    const fingerCurves = Arr.map(
      [
        [-0.045, 0.03, 0.08],
        [-0.015, 0.045, 0.11],
        [0.015, 0.04, 0.105],
        [0.042, 0.025, 0.085],
      ] as const,
      ([zOff, arch, len]) =>
        new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(0.11, 0, zOff),
            new Vector3(0.11 + len * 0.55, arch * 0.35, zOff),
            new Vector3(0.11 + len, -arch * 0.2, zOff),
          ]),
          10,
          0.013,
          8,
          false
        )
    );
    const thumb = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.04, 0.03, 0.05),
        new Vector3(0.085, 0.072, 0.068),
        new Vector3(0.125, 0.095, 0.072),
      ]),
      10,
      0.015,
      8,
      false
    );
    return {
      bicepsBelly,
      fingerCurves,
      humerus,
      olecranon,
      radius,
      thumb,
      tricepsBelly,
      ulna,
    };
  }, []);

  useEffect(
    () => () => {
      geos.humerus.dispose();
      geos.radius.dispose();
      geos.ulna.dispose();
      geos.bicepsBelly.dispose();
      geos.tricepsBelly.dispose();
      geos.olecranon.dispose();
      geos.thumb.dispose();
      for (const f of geos.fingerCurves) {
        f.dispose();
      }
    },
    [geos]
  );
  return geos;
}

/** Sculpted human leg skeleton & muscular attachments (femur, patella, tibia, fibula, arched foot, tendons). */
export function useLegGeometries() {
  const geos = useMemo(() => {
    const femur = buildLongBoneGeometry(0.76, 0.06);
    const tibia = buildLongBoneGeometry(0.68, 0.046);
    const fibula = buildLongBoneGeometry(0.64, 0.024);
    const quadBelly = buildFusiformBelly(0.54, 0.095);
    const hamBelly = buildFusiformBelly(0.54, 0.088);
    const tibialisBelly = buildFusiformBelly(0.44, 0.058);
    const calfBelly = buildCalfBelly();
    const patellarTendon = buildBandGeometry(
      [
        [0.11, 0.1, 0],
        [0.115, 0.01, 0],
        [0.075, -0.1, 0],
      ],
      0.022
    );
    const achillesTendon = buildBandGeometry(
      [
        [-0.1, -0.34, 0],
        [-0.082, -0.49, 0],
        [-0.068, -0.64, 0],
      ],
      0.022
    );
    const footArch = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.07, -0.02, 0),
        new Vector3(0.05, 0.02, 0),
        new Vector3(0.21, -0.02, 0),
        new Vector3(0.29, -0.025, 0),
      ]),
      18,
      0.042,
      14,
      false
    );
    return {
      achillesTendon,
      calfBelly,
      femur,
      fibula,
      footArch,
      hamBelly,
      patellarTendon,
      quadBelly,
      tibia,
      tibialisBelly,
    };
  }, []);

  useEffect(
    () => () => {
      geos.femur.dispose();
      geos.tibia.dispose();
      geos.fibula.dispose();
      geos.quadBelly.dispose();
      geos.hamBelly.dispose();
      geos.tibialisBelly.dispose();
      geos.calfBelly.dispose();
      geos.patellarTendon.dispose();
      geos.achillesTendon.dispose();
      geos.footArch.dispose();
    },
    [geos]
  );
  return geos;
}
