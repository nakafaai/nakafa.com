import {
  buildLaminaGeometry,
  buildRibbedFruitGeometry,
  buildStemGeometry,
} from "@repo/design-system/components/contents/biology/botanical";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry, Vector2, Vector3 } from "three";

/**
 * Builds sculpted entomological stage geometries shared across butterfly and
 * grasshopper metamorphosis: fluted eggs, arched 11-segment larva/nymph body,
 * sensory filaments, angular chrysalis, rooted arching woody branch, jumping
 * hind femora/tibiae, and veined tegmina forewings.
 */
export function useStageGeometries() {
  const geos = useMemo(() => {
    const egg = buildRibbedFruitGeometry({
      height: 0.11,
      radialSegments: 28,
      radius: 0.044,
      ribDepth: 0.09,
      ribs: 14,
      rows: 16,
    });

    const bodyPts = Arr.map(Arr.range(0, 56), (s) => {
      const t = s / 56;
      const taper = Math.sin(t * Math.PI) ** 0.44;
      const seg = 1 - 0.11 * Math.abs(Math.sin(t * Math.PI * 11));
      return new Vector2(
        Math.max(0.004, 0.072 * taper * seg),
        (t - 0.5) * 0.48
      );
    });
    const larvaBody = new LatheGeometry(bodyPts, 28);
    larvaBody.rotateZ(-Math.PI / 2);
    const bPos = larvaBody.getAttribute("position");
    const bUv = larvaBody.getAttribute("uv");
    for (let i = 0; i < bPos.count; i += 1) {
      const bx = bPos.getX(i);
      const by = bPos.getY(i);
      const t = Math.min(1, Math.max(0, bx / 0.48 + 0.5));
      bPos.setY(i, by + Math.sin(t * Math.PI) * 0.045);
      bUv.setXY(i, t, bUv.getX(i));
    }
    larvaBody.computeVertexNormals();

    const filament = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.04, 0.055, 0.025),
        new Vector3(0.095, 0.085, 0.048),
      ],
      0.007,
      0.0022,
      12,
      6
    );

    const pupaPts = Arr.map(Arr.range(0, 28), (s) => {
      const t = s / 28;
      const angularShoulder = 1 + 0.22 * Math.exp(-(((t - 0.72) / 0.12) ** 2));
      const taper = Math.sin(t * Math.PI) ** 0.58 * (0.72 + 0.35 * t);
      const seg =
        t > 0.65 ? 1 - 0.04 * Math.abs(Math.sin(t * Math.PI * 12)) : 1;
      return new Vector2(
        Math.max(0.003, 0.092 * taper * angularShoulder * seg),
        t * 0.34
      );
    });
    const chrysalis = new LatheGeometry(pupaPts, 10);
    chrysalis.computeVertexNormals();

    const pupaTwig = buildStemGeometry(
      [
        new Vector3(-0.82, 0.03, 0),
        new Vector3(-0.74, 0.26, -0.02),
        new Vector3(-0.46, 0.48, -0.01),
        new Vector3(-0.08, 0.54, 0.01),
        new Vector3(0.32, 0.48, 0.04),
      ],
      0.032,
      0.012,
      28,
      12
    );

    const hindFemur = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(-0.07, 0.08, 0.042),
        new Vector3(-0.14, 0.14, 0.056),
      ],
      0.026,
      0.012,
      14,
      10
    );
    const hindTibia = buildStemGeometry(
      [
        new Vector3(-0.14, 0.14, 0.056),
        new Vector3(-0.22, 0.04, 0.064),
        new Vector3(-0.27, -0.04, 0.072),
      ],
      0.01,
      0.005,
      14,
      8
    );

    const tegmina = buildLaminaGeometry({
      baseTaper: 0.24,
      cols: 10,
      cup: 0.022,
      droop: 0.02,
      length: 0.38,
      midribCrease: 0.006,
      notchDepth: 0,
      rows: 14,
      ruffleAmp: 0.002,
      ruffleFreq: 2,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.55,
      width: 0.1,
    });

    const ghAntenna = buildStemGeometry(
      [
        new Vector3(0, 0, 0),
        new Vector3(0.065, 0.045, 0.024),
        new Vector3(0.14, 0.06, 0.046),
      ],
      0.005,
      0.002,
      12,
      6
    );

    return {
      chrysalis,
      egg,
      filament,
      ghAntenna,
      hindFemur,
      hindTibia,
      larvaBody,
      pupaTwig,
      tegmina,
    };
  }, []);

  useEffect(
    () => () => {
      geos.egg.dispose();
      geos.larvaBody.dispose();
      geos.filament.dispose();
      geos.chrysalis.dispose();
      geos.pupaTwig.dispose();
      geos.hindFemur.dispose();
      geos.hindTibia.dispose();
      geos.tegmina.dispose();
      geos.ghAntenna.dispose();
    },
    [geos]
  );

  return geos;
}
