import {
  colorizeGeometry,
  leafBlade,
} from "@repo/design-system/components/contents/biology/flora";
import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Builds sculpted organic fauna specimens (herbivore beetles, mid-predator birds, soaring hawk) & rising thermal plumes. */
export function useTrophicSpecimens() {
  const assets = useMemo(() => {
    const chitin = new Color(BIOME_COLORS.insectChitin);
    const bronze = new Color(BIOME_COLORS.insectBronze);
    const abdomen = new SphereGeometry(0.085, 16, 12);
    abdomen.scale(1.35, 0.72, 0.92);
    abdomen.translate(-0.02, 0.055, 0);
    const thorax = new SphereGeometry(0.055, 12, 10);
    thorax.scale(1.1, 0.8, 0.9);
    thorax.translate(0.095, 0.052, 0);
    const head = new SphereGeometry(0.036, 10, 8);
    head.translate(0.145, 0.048, 0);
    const antL = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.16, 0.055, 0.015),
        new Vector3(0.21, 0.085, 0.045),
        new Vector3(0.24, 0.07, 0.07),
      ]),
      8,
      0.005,
      5,
      false
    );
    const antR = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.16, 0.055, -0.015),
        new Vector3(0.21, 0.085, -0.045),
        new Vector3(0.24, 0.07, -0.07),
      ]),
      8,
      0.005,
      5,
      false
    );
    const herbivore = mergeGeometries([
      colorizeGeometry(abdomen, chitin, bronze, 0.11),
      colorizeGeometry(thorax, bronze),
      colorizeGeometry(head, chitin),
      colorizeGeometry(antL, bronze),
      colorizeGeometry(antR, bronze),
    ]);

    const midCol = new Color(BIOME_COLORS.predatorOrange);
    const wingCol = new Color(BIOME_COLORS.raptorFeather);
    const beakCol = new Color(BIOME_COLORS.raptorGold);
    const bBody = new SphereGeometry(0.08, 16, 12);
    bBody.scale(1.45, 0.85, 0.85);
    bBody.translate(0, 0.085, 0);
    const bHead = new SphereGeometry(0.048, 12, 10);
    bHead.translate(0.1, 0.14, 0);
    const bTail = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.08, 0.09, 0),
        new Vector3(-0.18, 0.13, 0),
      ]),
      6,
      0.018,
      6,
      false
    );
    const bBeak = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.14, 0.14, 0),
        new Vector3(0.19, 0.13, 0),
      ]),
      5,
      0.01,
      5,
      false
    );
    const secondary = mergeGeometries([
      colorizeGeometry(bBody, wingCol, midCol, 0.15),
      colorizeGeometry(bHead, midCol),
      colorizeGeometry(bTail, wingCol),
      colorizeGeometry(bBeak, beakCol),
    ]);

    const feather = new Color(BIOME_COLORS.raptorFeather);
    const gold = new Color(BIOME_COLORS.raptorGold);
    const rBody = new SphereGeometry(0.085, 16, 12);
    rBody.scale(1.65, 0.82, 0.86);
    rBody.translate(0, 0.12, 0);
    const rHead = new SphereGeometry(0.052, 12, 10);
    rHead.translate(0.13, 0.16, 0);
    const rBeak = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.17, 0.16, 0),
        new Vector3(0.22, 0.135, 0),
      ]),
      6,
      0.012,
      5,
      false
    );
    const wingBlade = (side: 1 | -1) =>
      leafBlade(
        new Vector3(0.02, 0.14, side * 0.05),
        side * Math.PI * 0.54,
        0.34,
        0.52,
        0.2,
        0.22,
        6,
        feather,
        gold
      );
    const tailFan = leafBlade(
      new Vector3(-0.1, 0.12, 0),
      Math.PI,
      0.12,
      0.24,
      0.16,
      0.06,
      4,
      feather,
      gold
    );
    const apex = mergeGeometries([
      colorizeGeometry(rBody, feather, gold, 0.2),
      colorizeGeometry(rHead, gold),
      colorizeGeometry(rBeak, gold),
      wingBlade(1),
      wingBlade(-1),
      tailFan,
    ]);

    const log = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.22, 0.07, 0.08),
        new Vector3(0, 0.09, 0),
        new Vector3(0.2, 0.06, -0.08),
      ]),
      14,
      0.09,
      12,
      false
    );

    const heatRibbonA = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.08, 0.24, 0.04),
        new Vector3(-0.04, 0.48, -0.04),
        new Vector3(0.06, 0.72, 0.02),
      ]),
      24,
      0.022,
      8,
      false
    );
    const heatRibbonB = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.16, 0.14, -0.05),
        new Vector3(0.24, 0.36, 0.03),
        new Vector3(0.12, 0.58, -0.02),
        new Vector3(0.2, 0.82, 0.04),
      ]),
      24,
      0.018,
      8,
      false
    );

    return { apex, heatRibbonA, heatRibbonB, herbivore, log, secondary };
  }, []);

  useEffect(
    () => () => {
      assets.herbivore.dispose();
      assets.secondary.dispose();
      assets.apex.dispose();
      assets.log.dispose();
      assets.heatRibbonA.dispose();
      assets.heatRibbonB.dispose();
    },
    [assets]
  );
  return assets;
}
