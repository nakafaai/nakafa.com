import {
  buildLaminaGeometry,
  buildStemGeometry,
} from "@repo/design-system/components/contents/biology/botanical";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { Vector3 } from "three";

/**
 * Builds the sculpted parts the scanned specimens stand on: the woody host
 * stem and the coiling Cuscuta dodder of the parasitic plant, and the mossy
 * branch, strap leaves and velamen aerial roots of the epiphytic orchid.
 */
export function useCarnivoreGeometries() {
  const geos = useMemo(() => {
    // Parasitic mode: woody host stem + coiling Cuscuta dodder vine + haustoria pegs.
    const hostStem = buildStemGeometry(
      [
        new Vector3(0, 0.18, 0),
        new Vector3(-0.02, 0.54, 0.01),
        new Vector3(0.015, 0.94, -0.01),
        new Vector3(0, 1.32, 0),
      ],
      0.135,
      0.105,
      26,
      18,
      [
        { bulge: 0.08, t: 0.32, width: 0.05 },
        { bulge: 0.08, t: 0.68, width: 0.05 },
      ]
    );
    const dodderPts = Arr.makeBy(72, (k) => {
      const t = k / 71;
      const theta = t * Math.PI * 6.5;
      const r = 0.15 - t * 0.022 + 0.008 * Math.sin(theta * 2);
      return new Vector3(
        Math.cos(theta) * r,
        0.24 + t * 0.96,
        Math.sin(theta) * r
      );
    });
    const dodderHelix = buildStemGeometry(dodderPts, 0.021, 0.015, 76, 10);

    // Epiphytic mode: gnarled mossy host branch, veined orchid leaves, sculpted petals, aerial roots.
    const branch = buildStemGeometry(
      [
        new Vector3(-0.96, 0.36, -0.04),
        new Vector3(-0.34, 0.44, 0.03),
        new Vector3(0.32, 0.41, -0.02),
        new Vector3(0.96, 0.34, 0.04),
      ],
      0.135,
      0.105,
      32,
      18
    );
    const orchidLeaf = buildLaminaGeometry({
      baseTaper: 0.2,
      cols: 12,
      cup: 0.032,
      droop: 0.12,
      length: 0.48,
      midribCrease: 0.014,
      notchDepth: 0,
      rows: 16,
      ruffleAmp: 0.005,
      ruffleFreq: 3,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.66,
      width: 0.13,
    });
    const aerialRoots = Arr.map(
      [-0.22, -0.09, 0.04, 0.16, 0.27] as const,
      (xOff, idx) => ({
        geo: buildStemGeometry(
          [
            new Vector3(xOff * 0.65, 0.54, 0.06),
            new Vector3(xOff * 0.95, 0.42, 0.16),
            new Vector3(xOff * 1.12, 0.22, 0.18 + (idx % 2) * 0.04),
            new Vector3(xOff * 1.02, 0.04, 0.13),
          ],
          0.014,
          0.009,
          20,
          8
        ),
        id: `root-${xOff}`,
      })
    );

    return { aerialRoots, branch, dodderHelix, hostStem, orchidLeaf };
  }, []);

  useEffect(
    () => () => {
      geos.hostStem.dispose();
      geos.dodderHelix.dispose();
      geos.branch.dispose();
      geos.orchidLeaf.dispose();
      for (const r of geos.aerialRoots) {
        r.geo.dispose();
      }
    },
    [geos]
  );

  return geos;
}
