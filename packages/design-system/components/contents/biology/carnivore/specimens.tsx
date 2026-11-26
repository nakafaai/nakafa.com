import { leafBlade } from "@repo/design-system/components/contents/biology/flora";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Sculpted Nepenthes pitcher cup, operculum lid, peristome, dodder vine helix, and epiphytic orchid parts. */
export function useCarnivoreGeometries() {
  const geos = useMemo(() => {
    // Authentic lush tropical Nepenthes pitcher: ovoid lower digestive belly tapering smoothly into a wide upper waxy tube and flared mouth.
    const pitcherPts = Arr.map(Arr.range(0, 28), (s) => {
      const t = s / 28;
      const lowerBelly =
        0.22 * Math.sin(Math.min(1, t * 1.12) * Math.PI) ** 0.58;
      const upperTube = t > 0.42 ? 0.165 + (t - 0.42) * 0.05 : 0;
      const waist = 1 - 0.12 * Math.exp(-(((t - 0.58) / 0.16) ** 2));
      const baseBlend = Math.max(lowerBelly, upperTube);
      const flare = t > 0.88 ? 1 + (t - 0.88) * 1.15 : 1;
      const r = Math.max(
        0.012,
        (t < 0.06 ? t * 2.4 : 1) * baseBlend * waist * flare
      );
      return new Vector2(r, t * 0.82);
    });
    const pitcher = new LatheGeometry(pitcherPts, 40);
    const pPos = pitcher.getAttribute("position");
    const pCols = new Float32Array(pPos.count * 3);
    const baseCol = new Color(BOTANY_COLORS.windGreen);
    const rimCol = new Color(BOTANY_COLORS.carnivorePitcher);
    const tmp = new Color();
    for (let i = 0; i < pPos.count; i += 1) {
      const yNorm = Math.min(1, Math.max(0, pPos.getY(i) / 0.82));
      const ang = Math.atan2(pPos.getZ(i), pPos.getX(i));
      const mottle =
        0.5 +
        0.5 * Math.sin(ang * 5 + yNorm * 14) * Math.cos(ang * 3 - yNorm * 9);
      tmp.copy(baseCol).lerp(rimCol, yNorm * 0.72 + mottle * 0.28);
      pCols[i * 3] = tmp.r;
      pCols[i * 3 + 1] = tmp.g;
      pCols[i * 3 + 2] = tmp.b;
    }
    pitcher.setAttribute("color", new BufferAttribute(pCols, 3));
    pitcher.computeVertexNormals();

    // Heart-shaped arching operculum hood lid hinged cleanly to the posterior peristome rim.
    const lidShape = new Shape();
    lidShape.moveTo(0, -0.02);
    lidShape.bezierCurveTo(0.2, 0.02, 0.24, 0.24, 0, 0.34);
    lidShape.bezierCurveTo(-0.24, 0.24, -0.2, 0.02, 0, -0.02);
    const lid = new ExtrudeGeometry(lidShape, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      depth: 0.014,
    });
    lid.rotateX(Math.PI / 2);

    // Curved operculum hinge petiole anchoring the lid to the rear peristome rim.
    const lidHinge = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0.94, -0.2),
        new Vector3(0, 1.03, -0.22),
        new Vector3(0, 1.1, -0.16),
      ]),
      12,
      0.018,
      8,
      false
    );

    // Supporting curling tendril beneath the Nepenthes pitcher.
    const tendril = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0.03, 0),
        new Vector3(-0.08, -0.05, -0.06),
        new Vector3(-0.26, 0.12, -0.14),
        new Vector3(-0.42, 0.45, -0.18),
      ]),
      24,
      0.018,
      10,
      false
    );

    // Multi-turn helical coiling Cuscuta dodder vine wrapping tightly around host stem.
    const dodderPts = Arr.makeBy(64, (k) => {
      const t = k / 63;
      const theta = t * Math.PI * 6.5;
      const r = 0.175 + 0.012 * Math.sin(theta * 2);
      return new Vector3(
        Math.cos(theta) * r,
        0.1 + t * 0.96,
        Math.sin(theta) * r
      );
    });
    const dodderHelix = new TubeGeometry(
      new CatmullRomCurve3(dodderPts),
      72,
      0.022,
      10,
      false
    );

    // Gnarled horizontal mossy host branch for epiphytic orchid.
    const branch = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.92, 0.44, -0.04),
        new Vector3(-0.32, 0.49, 0.02),
        new Vector3(0.32, 0.46, -0.02),
        new Vector3(0.92, 0.42, 0.04),
      ]),
      28,
      0.13,
      16,
      false
    );

    // Lush rosette of 6 arching glossy orchid strap-leaves.
    const leafBase = new Color(BOTANY_COLORS.sepalGreen);
    const leafTip = new Color(BOTANY_COLORS.healthyLeaf);
    const orchidRosette = mergeGeometries(
      Arr.makeBy(6, (i) =>
        leafBlade(
          new Vector3(0, 0.57, 0),
          (i / 6) * Math.PI * 2 + 0.25,
          0.16 + (i % 2) * 0.08,
          0.44 + (i % 2) * 0.08,
          0.11,
          0.14,
          7,
          leafBase,
          leafTip
        )
      )
    );

    // Curved draping spongy velamen aerial roots hanging freely beneath the branch.
    const aerialRootCurves = Arr.map(
      [-0.22, -0.08, 0.06, 0.18, 0.28] as const,
      (xOff) => ({
        geo: new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(xOff * 0.7, 0.56, 0.06),
            new Vector3(xOff, 0.46, 0.15),
            new Vector3(xOff * 1.15, 0.24, 0.18),
            new Vector3(xOff * 1.05, 0.05, 0.14),
          ]),
          18,
          0.015,
          8,
          false
        ),
        id: `root-${xOff}`,
      })
    );

    return {
      aerialRootCurves,
      branch,
      dodderHelix,
      lid,
      lidHinge,
      orchidRosette,
      pitcher,
      tendril,
    };
  }, []);

  useEffect(
    () => () => {
      geos.pitcher.dispose();
      geos.lid.dispose();
      geos.lidHinge.dispose();
      geos.tendril.dispose();
      geos.dodderHelix.dispose();
      geos.branch.dispose();
      geos.orchidRosette.dispose();
      for (const r of geos.aerialRootCurves) {
        r.geo.dispose();
      }
    },
    [geos]
  );

  return geos;
}
