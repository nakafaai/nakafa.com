import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";

/** Builds sculpted almond-shaped cutaway ovary, lobulated corpus luteum, and helical spiral arteries. */
export function useMenstrualGeometries(liningHeight: number) {
  const assets = useMemo(() => {
    // Organic almond-shaped ovarian stroma cutaway shell.
    const ovary = new SphereGeometry(0.21, 36, 26);
    const oPos = ovary.getAttribute("position");
    for (let i = 0; i < oPos.count; i += 1) {
      const ux = oPos.getX(i);
      const uy = oPos.getY(i);
      const uz = oPos.getZ(i);
      const n = 1 + (valueNoise(ux * 14, uy * 14 + uz * 10, 19) - 0.5) * 0.08;
      // Flatten front face slightly into an anatomical cross-section window.
      const zCut = uz > 0.08 ? 0.08 + (uz - 0.08) * 0.22 : uz;
      oPos.setXYZ(i, ux * 1.38 * n, uy * 0.92 * n, zCut * 0.72);
    }
    ovary.computeVertexNormals();

    // Folded lobulated corpus luteum (characteristic scalloped glandular folds).
    const luteum = new SphereGeometry(0.1, 32, 24);
    const lPos = luteum.getAttribute("position");
    for (let i = 0; i < lPos.count; i += 1) {
      const ux = lPos.getX(i);
      const uy = lPos.getY(i);
      const uz = lPos.getZ(i);
      const ang = Math.atan2(uy, ux);
      const fold = 1 + 0.16 * Math.sin(ang * 7) * Math.cos(uz * 14);
      lPos.setXYZ(i, ux * fold, uy * fold, uz * 0.78 * fold);
    }
    luteum.computeVertexNormals();

    return { luteum, ovary };
  }, []);

  // Undulating glandular endometrium surface + coiled helical spiral arteries matching lining thickness.
  const liningAssets = useMemo(() => {
    const h = Math.max(0.05, liningHeight);
    const endometrium = new BoxGeometry(0.76, h, 0.28, 28, 6, 12);
    const ePos = endometrium.getAttribute("position");
    const colors = new Float32Array(ePos.count * 3);
    const baseCol = new Color(CELL_COLORS.reticulum);
    const deepCol = new Color(BIOLOGY_COLORS.blood);
    const tmp = new Color();

    for (let i = 0; i < ePos.count; i += 1) {
      const vx = ePos.getX(i);
      const vy = ePos.getY(i);
      const vz = ePos.getZ(i);
      const topNorm = (vy + h * 0.5) / h;
      let yOut = vy;
      if (topNorm > 0.75) {
        const wave =
          Math.sin(vx * 24) * Math.cos(vz * 22) * 0.016 +
          (valueNoise(vx * 18, vz * 18, 27) - 0.5) * 0.015;
        yOut += wave * topNorm;
      }
      ePos.setY(i, yOut);
      tmp.copy(baseCol).lerp(deepCol, Math.max(0, 1 - topNorm) * 0.34);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    endometrium.setAttribute("color", new BufferAttribute(colors, 3));
    endometrium.computeVertexNormals();

    // Three authentic tightly coiled helical spiral arteries rising through the functional endometrium.
    const arteries = Arr.map([-0.24, 0, 0.24] as const, (xBase) => {
      const turns = Math.max(2, Math.round(h * 14));
      const pts = Arr.makeBy(turns * 8 + 1, (k) => {
        const t = k / (turns * 8);
        const theta = t * turns * Math.PI * 2;
        const r = 0.022 * (0.45 + 0.55 * t);
        return new Vector3(
          xBase + Math.cos(theta) * r,
          t * h * 0.92,
          0.132 + Math.sin(theta) * 0.012
        );
      });
      return {
        geo: new TubeGeometry(new CatmullRomCurve3(pts), 44, 0.0085, 8, false),
        id: `sa-${xBase}`,
      };
    });

    return { arteries, endometrium };
  }, [liningHeight]);

  useEffect(
    () => () => {
      assets.ovary.dispose();
      assets.luteum.dispose();
    },
    [assets]
  );

  useEffect(
    () => () => {
      liningAssets.endometrium.dispose();
      for (const a of liningAssets.arteries) {
        a.geo.dispose();
      }
    },
    [liningAssets]
  );

  return { ...assets, ...liningAssets };
}
