import {
  colorizeGeometry,
  leafBlade,
} from "@repo/design-system/components/contents/biology/flora";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Color, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Builds a multi-stemmed woody shrub with curved branches and botanical leaf fans. */
export function useShrubGeometry(seed = 6) {
  const geometry = useMemo(() => {
    const bark = new Color(BIOME_COLORS.barkWarm);
    const leafDark = new Color(BIOME_COLORS.canopyDeep);
    const leafMid = new Color(BIOME_COLORS.shrubGreen);
    const leafSun = new Color(BIOME_COLORS.canopySun);
    const parts = Arr.flatMap(Arr.range(0, 6), (s) => {
      const yaw = (s / 7) * Math.PI * 2 + hashUnit(seed + s, 1) * 0.5;
      const spread = 0.18 + hashUnit(seed + s, 3) * 0.14;
      const h = 0.28 + hashUnit(seed + s, 5) * 0.16;
      const curve = new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(
          Math.cos(yaw) * spread * 0.45,
          h * 0.55,
          Math.sin(yaw) * spread * 0.45
        ),
        new Vector3(Math.cos(yaw) * spread, h, Math.sin(yaw) * spread),
      ]);
      const leaves = Arr.map(Arr.range(0, 6), (b) => {
        const t = 0.42 + (b / 6) * 0.58;
        const pt = curve.getPoint(t);
        const la = yaw + (b - 3) * 0.82 + hashUnit(seed + s * 7 + b, 9) * 0.4;
        return leafBlade(
          pt,
          la,
          0.2 + hashUnit(seed + b, 11) * 0.45,
          0.12 + hashUnit(seed + s + b, 13) * 0.05,
          0.058,
          0.22,
          4,
          b % 2 === 0 ? leafDark : leafMid,
          leafSun
        );
      });
      return [
        colorizeGeometry(new TubeGeometry(curve, 10, 0.014, 6, false), bark),
        ...leaves,
      ];
    });
    return mergeGeometries(parts);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds dense layered drooping pine needle boughs around the conifer trunk. */
function buildPineBoughs(seed: number) {
  const deep = new Color(BIOME_COLORS.canopyDeep);
  const mid = new Color(BIOME_COLORS.canopyEmerald);
  const sun = new Color(BIOME_COLORS.canopySun);
  const tiers = Arr.flatMap(Arr.range(0, 7), (tier) => {
    const frac = tier / 7;
    const y = 0.34 + frac * 0.8;
    const branches = 8 - Math.floor(frac * 3);
    const boughLen = (1 - frac * 0.74) * 0.48;
    const baseCol = tier < 3 ? deep : mid;
    return Arr.flatMap(Arr.range(0, branches - 1), (b) => {
      const yaw =
        (b / branches) * Math.PI * 2 +
        tier * 0.55 +
        hashUnit(seed + tier * 9 + b, 3) * 0.25;
      return Arr.map([-0.24, 0, 0.24] as const, (spread) =>
        leafBlade(
          new Vector3(0, y, 0),
          yaw + spread,
          -0.22 + frac * 0.32,
          boughLen * (spread === 0 ? 1 : 0.85),
          boughLen * 0.44,
          0.34 - frac * 0.14,
          5,
          baseCol,
          sun
        )
      );
    });
  });
  const crown = Arr.map([0.4, 1.9, 3.5, 5.0] as const, (yaw) =>
    leafBlade(new Vector3(0, 1.1, 0), yaw, 1.15, 0.2, 0.085, 0.12, 4, mid, sun)
  );
  return mergeGeometries([...tiers, ...crown]);
}

/** Builds a realistic conifer/pine tree with gnarled bark trunk and tiered needle boughs. */
export function usePineTree(seed = 7) {
  const { foliage, trunk } = useMemo(() => {
    const trunkCurve = new CatmullRomCurve3([
      new Vector3(0, 0, 0),
      new Vector3(0.02, 0.36, -0.01),
      new Vector3(-0.01, 0.78, 0.015),
      new Vector3(0, 1.18, 0),
    ]);
    const trunkGeom = new TubeGeometry(trunkCurve, 18, 0.052, 10, false);
    const tPos = trunkGeom.getAttribute("position");
    for (let i = 0; i < tPos.count; i += 1) {
      const y = tPos.getY(i);
      const taper = Math.max(0.22, 1 - (y / 1.24) * 0.78);
      const flare = y < 0.14 ? 1 + (0.14 - y) * 3.2 : 1;
      tPos.setX(i, tPos.getX(i) * taper * flare);
      tPos.setZ(i, tPos.getZ(i) * taper * flare);
    }
    trunkGeom.computeVertexNormals();
    return { foliage: buildPineBoughs(seed), trunk: trunkGeom };
  }, [seed]);
  useEffect(
    () => () => {
      trunk.dispose();
      foliage.dispose();
    },
    [foliage, trunk]
  );
  return { foliage, trunk };
}

/** Builds a realistic spreading broadleaf shade tree with fork branches and dappled leaf clusters. */
export function useBroadleafTree(seed = 8) {
  const { foliage, trunk } = useMemo(() => {
    const mainTrunk = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.03, 0.34, 0.01),
        new Vector3(-0.02, 0.66, -0.02),
      ]),
      14,
      0.068,
      10,
      false
    );
    const tp = mainTrunk.getAttribute("position");
    for (let i = 0; i < tp.count; i += 1) {
      const y = tp.getY(i);
      const taper = Math.max(0.55, 1 - y * 0.55);
      const flare = y < 0.14 ? 1 + (0.14 - y) * 3.0 : 1;
      tp.setX(i, tp.getX(i) * taper * flare);
      tp.setZ(i, tp.getZ(i) * taper * flare);
    }
    mainTrunk.computeVertexNormals();

    const deep = new Color(BIOME_COLORS.canopyDeep);
    const mid = new Color(BIOME_COLORS.canopyEmerald);
    const sun = new Color(BIOME_COLORS.canopySun);
    const limbs = Arr.map(Arr.range(0, 4), (l) => {
      const yaw = (l / 5) * Math.PI * 2 + hashUnit(seed + l, 2) * 0.4;
      const reach = 0.34 + hashUnit(seed + l, 4) * 0.12;
      const tipY = 0.92 + hashUnit(seed + l, 6) * 0.18;
      const curve = new CatmullRomCurve3([
        new Vector3(-0.01, 0.58, -0.01),
        new Vector3(
          Math.cos(yaw) * reach * 0.52,
          0.78,
          Math.sin(yaw) * reach * 0.52
        ),
        new Vector3(Math.cos(yaw) * reach, tipY, Math.sin(yaw) * reach),
      ]);
      const tip = curve.getPoint(1);
      const leaves = Arr.map(Arr.range(0, 9), (f) => {
        const fa = (f / 10) * Math.PI * 2 + hashUnit(seed + l * 10 + f, 7);
        const pitch = -0.15 + hashUnit(seed + l * 10 + f, 9) * 0.85;
        const offset = new Vector3(
          Math.cos(fa) * 0.09,
          (hashUnit(seed + f, 11) - 0.3) * 0.14,
          Math.sin(fa) * 0.09
        );
        return leafBlade(
          tip.clone().add(offset),
          fa,
          pitch,
          0.22 + hashUnit(seed + l + f, 13) * 0.08,
          0.11,
          0.22,
          4,
          f % 3 === 0 ? deep : mid,
          sun
        );
      });
      return {
        branch: new TubeGeometry(curve, 10, 0.028, 7, false).toNonIndexed(),
        leaves,
      };
    });
    return {
      foliage: mergeGeometries(Arr.flatMap(limbs, (item) => item.leaves)),
      trunk: mergeGeometries([
        mainTrunk.toNonIndexed(),
        ...Arr.map(limbs, (item) => item.branch),
      ]),
    };
  }, [seed]);
  useEffect(
    () => () => {
      trunk.dispose();
      foliage.dispose();
    },
    [foliage, trunk]
  );
  return { foliage, trunk };
}
