import {
  buildLaminaGeometry,
  buildRibbedFruitGeometry,
  buildStemGeometry,
} from "@repo/design-system/components/contents/biology/botanical";
import { useEffect, useMemo } from "react";
import { Vector3 } from "three";

/**
 * Builds sculpted photorealistic botanical plant geometries for the
 * Phytohormone Action Lab: fibrous tapered herbaceous stem with anatomical
 * swollen leaf nodes, serrated cupped foliage blades with curved petioles,
 * overlapping scaly apical bud crown, lateral axillary shoot sprig, curved
 * pedicel, ribbed heirloom tomato fruit, and 5-pointed curling star calyx.
 */
export function useHormoneBotanyGeometries(stemHeight: number) {
  const staticGeos = useMemo(() => {
    // Ribbed heirloom tomato fruit with gentle 6-carpel lobing & dimpled shoulder.
    const fruit = buildRibbedFruitGeometry({
      height: 0.21,
      radialSegments: 36,
      radius: 0.132,
      ribDepth: 0.075,
      ribs: 6,
      rows: 22,
    });

    // Individual curling green calyx sepal forming the 5-pointed fruit star.
    const calyxSepal = buildLaminaGeometry({
      baseTaper: 0.45,
      cols: 8,
      cup: 0.012,
      droop: 0.032,
      length: 0.1,
      midribCrease: 0.005,
      notchDepth: 0,
      rows: 10,
      ruffleAmp: 0.003,
      ruffleFreq: 2,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.85,
      width: 0.036,
    });

    // Pointed cupped overlapping imbricate bud scale for the scaly apical crown.
    const budScale = buildLaminaGeometry({
      baseTaper: 0.3,
      cols: 10,
      cup: 0.032,
      droop: -0.025,
      length: 0.115,
      midribCrease: 0.008,
      notchDepth: 0,
      rows: 12,
      ruffleAmp: 0.002,
      ruffleFreq: 2,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.84,
      width: 0.056,
    });

    // Unfurling young folded leaf primordium arching out from the apical crown.
    const primordium = buildLaminaGeometry({
      baseTaper: 0.28,
      cols: 10,
      cup: 0.036,
      droop: 0.028,
      length: 0.165,
      midribCrease: 0.012,
      notchDepth: 0,
      rows: 14,
      ruffleAmp: 0.004,
      ruffleFreq: 3,
      serrationAmp: 0.06,
      serrationTeeth: 5,
      tipPower: 0.78,
      width: 0.078,
    });

    // Serrated cupped veined botanical leaf blade + curved tapering petiole.
    const leafBladeGeo = buildLaminaGeometry({
      baseTaper: 0.28,
      cols: 16,
      cup: 0.044,
      droop: 0.095,
      length: 0.48,
      midribCrease: 0.016,
      notchDepth: 0,
      rows: 20,
      ruffleAmp: 0.009,
      ruffleFreq: 5,
      serrationAmp: 0.085,
      serrationTeeth: 9,
      tipPower: 0.72,
      width: 0.25,
    });

    const petiole = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.055, 0.018, 0),
        new Vector3(0.115, 0.016, 0),
      ],
      0.014,
      0.009,
      12,
      8
    );

    // Axillary lateral shoot leaflet & tiny shoot stem.
    const lateralLeaflet = buildLaminaGeometry({
      baseTaper: 0.26,
      cols: 10,
      cup: 0.024,
      droop: 0.035,
      length: 0.18,
      midribCrease: 0.009,
      notchDepth: 0,
      rows: 12,
      ruffleAmp: 0.004,
      ruffleFreq: 3,
      serrationAmp: 0.075,
      serrationTeeth: 6,
      tipPower: 0.74,
      width: 0.092,
    });
    const lateralStem = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.055, 0.032, 0.006),
        new Vector3(0.11, 0.052, 0.01),
      ],
      0.014,
      0.007,
      12,
      8
    );

    return {
      budScale,
      calyxSepal,
      fruit,
      lateralLeaflet,
      lateralStem,
      leafBladeGeo,
      petiole,
      primordium,
    };
  }, []);

  const dynamicGeos = useMemo(() => {
    // Smoothly tapered herbaceous stem with swollen anatomical leaf nodes.
    const stem = buildStemGeometry(
      [
        new Vector3(0, 0.04, 0),
        new Vector3(-0.022, 0.04 + stemHeight * 0.34, 0.012),
        new Vector3(0.016, 0.04 + stemHeight * 0.68, -0.01),
        new Vector3(0, 0.04 + stemHeight, 0),
      ],
      0.046,
      0.022,
      32,
      16,
      [
        { bulge: 0.28, t: 0.38, width: 0.045 },
        { bulge: 0.24, t: 0.68, width: 0.045 },
      ]
    );

    // Curved woody fruit pedicel arching cleanly from upper stem node to fruit calyx.
    const pedicel = buildStemGeometry(
      [
        new Vector3(0.012, 0.04 + stemHeight * 0.7, -0.004),
        new Vector3(0.14, 0.04 + stemHeight * 0.77, 0.048),
        new Vector3(0.26, 0.04 + stemHeight * 0.66, 0.085),
      ],
      0.013,
      0.009,
      18,
      8
    );

    return { pedicel, stem };
  }, [stemHeight]);

  useEffect(
    () => () => {
      staticGeos.fruit.dispose();
      staticGeos.calyxSepal.dispose();
      staticGeos.budScale.dispose();
      staticGeos.primordium.dispose();
      staticGeos.leafBladeGeo.dispose();
      staticGeos.petiole.dispose();
      staticGeos.lateralLeaflet.dispose();
      staticGeos.lateralStem.dispose();
    },
    [staticGeos]
  );

  useEffect(
    () => () => {
      dynamicGeos.stem.dispose();
      dynamicGeos.pedicel.dispose();
    },
    [dynamicGeos]
  );

  return { ...staticGeos, ...dynamicGeos };
}
