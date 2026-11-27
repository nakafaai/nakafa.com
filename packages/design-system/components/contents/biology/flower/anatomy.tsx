import {
  buildLaminaGeometry,
  buildRibbedFruitGeometry,
  buildStemGeometry,
} from "@repo/design-system/components/contents/biology/botanical";
import type { PollinationMode } from "@repo/design-system/components/contents/biology/flower/model";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry, SphereGeometry, Vector2, Vector3 } from "three";

/**
 * Builds sculpted photorealistic floral anatomy: fibrous pedicel + ribbed
 * receptacle, basal stem leaves, 5 curved veined sepals, 5 cupped ruffled
 * petals, cutaway ovary wall + locule chamber + ovules + growing pollen tube,
 * tapered style + bumpy 3-lobed receptive stigma (or feathery plumose plumes),
 * curved tapering filaments + grooved bilobed anthers, and echinulate pollen.
 */
export function useFlowerGeometries(
  mode: PollinationMode,
  petalScale: number,
  filamentLength: number
) {
  const geos = useMemo(() => {
    // Organic curved fibrous pedicel stem rising from potted soil to receptacle.
    const pedicel = buildStemGeometry(
      [
        new Vector3(0, 0.22, 0),
        new Vector3(-0.015, 0.38, 0.01),
        new Vector3(0.01, 0.52, -0.008),
        new Vector3(0, 0.62, 0),
      ],
      0.044,
      0.036,
      20,
      14,
      [{ bulge: 0.16, t: 0.42, width: 0.07 }]
    );

    // Ribbed swollen floral receptacle cradling the calyx and ovary.
    const receptacle = buildRibbedFruitGeometry({
      height: 0.14,
      radialSegments: 28,
      radius: 0.115,
      ribDepth: 0.05,
      ribs: 5,
      rows: 14,
    });

    // Basal cauline leaves framing the lower pedicel above the terracotta pot.
    const basalLeaf = buildLaminaGeometry({
      baseTaper: 0.3,
      cols: 12,
      cup: 0.035,
      droop: 0.08,
      length: 0.36,
      midribCrease: 0.012,
      notchDepth: 0,
      rows: 14,
      ruffleAmp: 0.006,
      ruffleFreq: 4,
      serrationAmp: 0.06,
      serrationTeeth: 7,
      tipPower: 0.72,
      width: 0.16,
    });

    // Individual veined curved calyx sepal.
    const sepal = buildLaminaGeometry({
      baseTaper: 0.35,
      cols: 12,
      cup: 0.024,
      droop: 0.11,
      length: 0.38,
      midribCrease: 0.012,
      notchDepth: 0,
      rows: 16,
      ruffleAmp: 0.006,
      ruffleFreq: 3,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.76,
      width: 0.115,
    });

    // Lush cupped, organically ruffled, slightly notched silk botanical petal.
    const petal = buildLaminaGeometry({
      baseTaper: -0.24,
      cols: 18,
      cup: 0.075 * petalScale,
      droop: 0.03 * petalScale,
      length: 0.64 * petalScale,
      midribCrease: 0.005,
      notchDepth: mode === "insect" ? 0.055 : 0.01,
      rows: 22,
      ruffleAmp: (mode === "insect" ? 0.018 : 0.006) * petalScale,
      ruffleFreq: 6,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.62,
      width: 0.42 * petalScale,
    });

    // Swollen pear-shaped cutaway ovary with anterior inspection window (+Z).
    const ovaryPts = Arr.map(Arr.range(0, 22), (s) => {
      const t = s / 22;
      const r = Math.max(
        0.005,
        0.168 * Math.sin(t * Math.PI) ** 0.68 * (1 - t * 0.28)
      );
      return new Vector2(r, t * 0.34);
    });
    const ovaryShell = new LatheGeometry(
      ovaryPts,
      34,
      Math.PI * 0.26,
      Math.PI * 1.48
    );
    ovaryShell.computeVertexNormals();

    // Inner locule tissue lining cleanly recessed behind ovules.
    const loculePts = Arr.map(Arr.range(0, 18), (s) => {
      const t = s / 18;
      const r = Math.max(
        0.004,
        0.124 * Math.sin(t * Math.PI) ** 0.72 * (1 - t * 0.28)
      );
      return new Vector2(r, 0.035 + t * 0.27);
    });
    const loculeCore = new LatheGeometry(
      loculePts,
      28,
      Math.PI * 0.38,
      Math.PI * 1.24
    );
    loculeCore.computeVertexNormals();

    // Gently tapering curved style rising from the ovary apex.
    const style = buildStemGeometry(
      [
        new Vector3(0, 0.93, 0),
        new Vector3(0.008, 1.12, 0.005),
        new Vector3(0, 1.32, 0),
      ],
      0.044,
      0.028,
      18,
      14
    );

    // Growing translucent golden pollen tube descending from stigma to ovule.
    const pollenTube = buildStemGeometry(
      [
        new Vector3(0.01, 1.33, 0.015),
        new Vector3(0.014, 1.14, 0.022),
        new Vector3(0.018, 0.94, 0.028),
        new Vector3(0.036, 0.82, 0.032),
      ],
      0.0085,
      0.0065,
      24,
      8
    );

    // Sculpted velvety bumpy stigma lobe (organic receptive pad with papillae relief).
    const stigmaLobe = new SphereGeometry(0.044, 22, 16);
    const sPos = stigmaLobe.getAttribute("position");
    for (let i = 0; i < sPos.count; i += 1) {
      const vx = sPos.getX(i);
      const vy = sPos.getY(i);
      const vz = sPos.getZ(i);
      const papilla =
        1 + 0.16 * (valueNoise(vx * 82 + 3, vy * 82 + vz * 64, 64) - 0.5);
      sPos.setXYZ(
        i,
        vx * 1.15 * papilla,
        vy * 0.68 * papilla,
        vz * 0.95 * papilla
      );
    }
    stigmaLobe.computeVertexNormals();

    // Sculpted kidney-shaped grooved anther theca lobe.
    const thecaPts = Arr.map(Arr.range(0, 18), (s) => {
      const t = s / 18;
      const r = Math.max(0.003, 0.026 * Math.sin(t * Math.PI) ** 0.55);
      return new Vector2(r, (t - 0.5) * 0.115);
    });
    const antherTheca = new LatheGeometry(thecaPts, 18);
    antherTheca.computeVertexNormals();

    // Sculpted spiky echinulate golden pollen grain.
    const pollenGrain = new SphereGeometry(1, 18, 14);
    const pPos = pollenGrain.getAttribute("position");
    for (let i = 0; i < pPos.count; i += 1) {
      const vx = pPos.getX(i);
      const vy = pPos.getY(i);
      const vz = pPos.getZ(i);
      const spike =
        1 +
        0.22 *
          Math.max(
            0,
            Math.sin(vx * 14) * Math.sin(vy * 14) * Math.sin(vz * 14)
          );
      pPos.setXYZ(i, vx * spike, vy * spike, vz * spike);
    }
    pollenGrain.computeVertexNormals();

    // 4 arching tapered filaments flanking the carpel symmetrically.
    const stamenSpecs = [
      { ang: -0.78, z: -0.05 },
      { ang: -0.32, z: 0.04 },
      { ang: 0.32, z: 0.04 },
      { ang: 0.78, z: -0.05 },
    ] as const;
    const stamens = Arr.map(stamenSpecs, (sp) => {
      const dir = sp.ang >= 0 ? 1 : -1;
      const spread = Math.abs(sp.ang) * (mode === "wind" ? 0.56 : 0.44);
      const topY = 0.68 + filamentLength * (mode === "wind" ? 1.06 : 0.95);
      const tip = new Vector3(dir * spread, topY, sp.z);
      const filament = buildStemGeometry(
        [
          new Vector3(dir * 0.065, 0.66, sp.z * 0.3),
          new Vector3(
            dir * spread * 0.74,
            0.66 + filamentLength * 0.58,
            sp.z * 0.7
          ),
          tip,
        ],
        0.016,
        0.0085,
        20,
        8
      );
      return {
        filament,
        id: `st-${sp.ang}`,
        tiltZ: -dir * 0.24,
        tip: [tip.x, tip.y, tip.z] as const,
      };
    });

    // Feathery multi-branched plumose stigma plumes for wind-pollinated flowers.
    const plumoseBranches = Arr.flatMap(Arr.range(0, 7), (i) => {
      const a = (i / 8) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const main = buildStemGeometry(
        [
          new Vector3(0, 0, 0),
          new Vector3(dx * 0.11, 0.045, dz * 0.08),
          new Vector3(dx * 0.22, 0.015, dz * 0.15),
        ],
        0.007,
        0.002,
        12,
        6
      );
      const barb = buildStemGeometry(
        [
          new Vector3(dx * 0.1, 0.04, dz * 0.07),
          new Vector3(dx * 0.16 - dz * 0.05, 0.075, dz * 0.12 + dx * 0.05),
        ],
        0.004,
        0.0015,
        8,
        5
      );
      return [
        { geo: main, id: `pl-m-${i}` },
        { geo: barb, id: `pl-b-${i}` },
      ];
    });

    return {
      antherTheca,
      basalLeaf,
      loculeCore,
      ovaryShell,
      pedicel,
      petal,
      plumoseBranches,
      pollenGrain,
      pollenTube,
      receptacle,
      sepal,
      stamens,
      stigmaLobe,
      style,
    };
  }, [filamentLength, mode, petalScale]);

  useEffect(
    () => () => {
      geos.pedicel.dispose();
      geos.receptacle.dispose();
      geos.basalLeaf.dispose();
      geos.sepal.dispose();
      geos.petal.dispose();
      geos.ovaryShell.dispose();
      geos.loculeCore.dispose();
      geos.style.dispose();
      geos.pollenTube.dispose();
      geos.stigmaLobe.dispose();
      geos.antherTheca.dispose();
      geos.pollenGrain.dispose();
      for (const s of geos.stamens) {
        s.filament.dispose();
      }
      for (const p of geos.plumoseBranches) {
        p.geo.dispose();
      }
    },
    [geos]
  );

  return geos;
}
