import {
  buildLaminaGeometry,
  buildStemGeometry,
} from "@repo/design-system/components/contents/biology/botanical";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { LatheGeometry, TorusGeometry, Vector2, Vector3 } from "three";

/**
 * Builds sculpted photorealistic geometries for carnivorous Nepenthes pitcher
 * (mottled cutaway cup, flared ribbed peristome, vaulted hinged operculum,
 * dorsal spur, basal rosette leaves, curling tendril), parasitic Cuscuta
 * dodder helix + haustoria, and epiphytic orchid (strap leaves, multi-petal
 * bloom, labellum, velamen aerial roots).
 */
export function useCarnivoreGeometries() {
  const geos = useMemo(() => {
    // Authentic tropical Nepenthes pitcher silhouette: ovoid lower digestive belly
    // narrowing gently at the hip before flaring into the upper waxy tube.
    const pitcherPts = Arr.map(Arr.range(0, 32), (s) => {
      const t = s / 32;
      const lowerBelly =
        0.21 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.56;
      const upperTube = t > 0.38 ? 0.152 + (t - 0.38) * 0.068 : 0;
      const waist = 1 - 0.11 * Math.exp(-(((t - 0.54) / 0.15) ** 2));
      const flare = t > 0.86 ? 1 + (t - 0.86) * 1.1 : 1;
      const baseBlend = Math.max(lowerBelly, upperTube);
      const r = Math.max(
        0.014,
        (t < 0.06 ? 0.18 + t * 13.5 : 1) * baseBlend * waist * flare
      );
      return new Vector2(r, t * 0.78);
    });

    // Translucent anterior cutaway opening (+Z window) so the digestive fluid
    // meniscus inside the lower belly is clearly visible.
    const pitcher = new LatheGeometry(
      pitcherPts,
      44,
      Math.PI * 0.22,
      Math.PI * 1.56
    );
    pitcher.computeVertexNormals();

    // Inner translucent glandular cutaway window closing the visual silhouette softly.
    const cutawayGlass = new LatheGeometry(
      pitcherPts,
      24,
      -Math.PI * 0.22,
      Math.PI * 0.44
    );
    cutawayGlass.computeVertexNormals();

    // Flared ribbed peristome collar curving over the mouth rim.
    const peristome = new TorusGeometry(0.198, 0.042, 22, 56);
    peristome.rotateX(Math.PI / 2);
    peristome.scale(1.04, 0.84, 1.08);
    peristome.computeVertexNormals();

    // Digestive enzyme fluid body + concave curved meniscus surface.
    const fluidPts = [
      new Vector2(0.002, 0.06),
      new Vector2(0.115, 0.08),
      new Vector2(0.165, 0.17),
      new Vector2(0.172, 0.28),
      new Vector2(0.168, 0.31),
      new Vector2(0.11, 0.292),
      new Vector2(0.002, 0.288),
    ];
    const digestiveFluid = new LatheGeometry(fluidPts, 36);
    digestiveFluid.computeVertexNormals();

    // Vaulted heart-shaped cordate operculum hood arching cleanly over the mouth.
    const lid = buildLaminaGeometry({
      baseTaper: -0.25,
      cols: 16,
      cup: -0.075,
      droop: 0.05,
      length: 0.36,
      midribCrease: -0.012,
      notchDepth: 0.045,
      rows: 20,
      ruffleAmp: 0.014,
      ruffleFreq: 5,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.68,
      width: 0.32,
    });
    // Orient lid so base sits at rear (-Z) and arches forward toward +Z.
    lid.rotateY(-Math.PI / 2);

    // Organic tapering neck + posterior dorsal spur connecting lid to rear peristome.
    const lidNeck = buildStemGeometry(
      [
        new Vector3(0, 0.77, -0.19),
        new Vector3(0, 0.85, -0.21),
        new Vector3(0, 0.91, -0.15),
      ],
      0.022,
      0.014,
      14,
      10
    );
    const dorsalSpur = buildStemGeometry(
      [
        new Vector3(0, 0.84, -0.21),
        new Vector3(0, 0.87, -0.26),
        new Vector3(0, 0.85, -0.29),
      ],
      0.009,
      0.002,
      8,
      6
    );

    // Basal Nepenthes leaf blade emerging from the mossy terracotta pot.
    const basalLeaf = buildLaminaGeometry({
      baseTaper: 0.32,
      cols: 14,
      cup: 0.036,
      droop: 0.09,
      length: 0.56,
      midribCrease: 0.014,
      notchDepth: 0,
      rows: 18,
      ruffleAmp: 0.008,
      ruffleFreq: 4,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.72,
      width: 0.19,
    });

    // Continuous curling tendril connecting the main basal leaf tip to the pitcher base.
    const tendril = buildStemGeometry(
      [
        new Vector3(-0.34, 0.34, -0.08),
        new Vector3(-0.46, 0.25, -0.12),
        new Vector3(-0.34, 0.12, -0.08),
        new Vector3(-0.14, 0.16, -0.02),
        new Vector3(0.06, 0.26, 0),
        new Vector3(0.14, 0.34, 0),
      ],
      0.016,
      0.022,
      34,
      10
    );

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
    const orchidPetal = buildLaminaGeometry({
      baseTaper: -0.18,
      cols: 10,
      cup: 0.025,
      droop: -0.01,
      length: 0.16,
      midribCrease: 0.004,
      notchDepth: 0.02,
      rows: 12,
      ruffleAmp: 0.008,
      ruffleFreq: 4,
      serrationAmp: 0,
      serrationTeeth: 0,
      tipPower: 0.65,
      width: 0.11,
    });
    const flowerStem = buildStemGeometry(
      [
        new Vector3(0.02, 0.56, 0),
        new Vector3(0.06, 0.78, 0.03),
        new Vector3(0.14, 0.94, 0.06),
      ],
      0.012,
      0.008,
      16,
      8
    );
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

    return {
      aerialRoots,
      basalLeaf,
      branch,
      cutawayGlass,
      digestiveFluid,
      dodderHelix,
      dorsalSpur,
      flowerStem,
      hostStem,
      lid,
      lidNeck,
      orchidLeaf,
      orchidPetal,
      peristome,
      pitcher,
      tendril,
    };
  }, []);

  useEffect(
    () => () => {
      geos.pitcher.dispose();
      geos.cutawayGlass.dispose();
      geos.peristome.dispose();
      geos.digestiveFluid.dispose();
      geos.lid.dispose();
      geos.lidNeck.dispose();
      geos.dorsalSpur.dispose();
      geos.basalLeaf.dispose();
      geos.tendril.dispose();
      geos.hostStem.dispose();
      geos.dodderHelix.dispose();
      geos.branch.dispose();
      geos.orchidLeaf.dispose();
      geos.orchidPetal.dispose();
      geos.flowerStem.dispose();
      for (const r of geos.aerialRoots) {
        r.geo.dispose();
      }
    },
    [geos]
  );

  return geos;
}
