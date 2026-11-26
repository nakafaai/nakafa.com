import { BIOME_COLORS } from "@repo/design-system/lib/material/biome";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  LatheGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

export const RIB_LEVELS = [
  { id: "r1", spread: 0.56, y: 1.04 },
  { id: "r2", spread: 0.64, y: 0.9 },
  { id: "r3", spread: 0.69, y: 0.76 },
  { id: "r4", spread: 0.71, y: 0.62 },
  { id: "r5", spread: 0.68, y: 0.48 },
  { id: "r6", spread: 0.62, y: 0.35 },
] as const;

/** Sculpted muscular diaphragm with bilateral domes and fibrous central tendon trefoil. */
export function useSculptedDiaphragm() {
  const geometry = useMemo(() => {
    const geom = new SphereGeometry(
      1,
      56,
      28,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.54
    );
    const pos = geom.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const muscleCol = new Color(BIOME_COLORS.diaphragmRose);
    const tendonCol = new Color(BIOME_COLORS.diaphragmTendon);
    const c = new Color();

    for (let i = 0; i < pos.count; i += 1) {
      const ux = pos.getX(i);
      const uy = pos.getY(i);
      const uz = pos.getZ(i);
      const domeMod =
        1 +
        (ux < 0 ? 0.14 : 0.06) * Math.exp(-((Math.abs(ux) - 0.48) ** 2) * 5) -
        0.12 * Math.exp(-(ux * ux * 10));
      const ribRipple =
        1 + 0.025 * Math.sin(Math.atan2(uz, ux) * 18) * (1 - uy);
      pos.setXYZ(
        i,
        ux * 0.66 * ribRipple,
        uy * 0.34 * domeMod,
        uz * 0.47 * ribRipple
      );

      const radial = Math.hypot(ux, uz);
      const tendonMask = Math.max(0, 1 - radial * 1.65);
      const striation = 0.92 + 0.08 * Math.sin(Math.atan2(uz, ux) * 42);
      c.copy(muscleCol)
        .multiplyScalar(striation)
        .lerp(tendonCol, tendonMask ** 1.3);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute("color", new BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Builds anatomical rib pair curves sweeping posteriorly from spine to anterior costal cartilage. */
export function useRibArcs() {
  const arcs = useMemo(
    () =>
      Arr.flatMap(RIB_LEVELS, (lvl) =>
        Arr.map([-1, 1] as const, (side) => {
          const w = lvl.spread;
          const d = w * 0.72;
          const slope = 0.11;
          const boneCurve = new CatmullRomCurve3([
            new Vector3(side * 0.06, lvl.y + 0.04, -d * 0.88),
            new Vector3(side * w * 0.72, lvl.y + 0.02, -d * 0.68),
            new Vector3(side * w, lvl.y - slope * 0.45, -d * 0.05),
            new Vector3(side * w * 0.78, lvl.y - slope, d * 0.56),
          ]);
          const cartilageCurve = new CatmullRomCurve3([
            new Vector3(side * w * 0.78, lvl.y - slope, d * 0.56),
            new Vector3(side * w * 0.4, lvl.y - slope * 0.78, d * 0.78),
            new Vector3(side * 0.07, lvl.y - slope * 0.45, d * 0.84),
          ]);
          return {
            bone: new TubeGeometry(boneCurve, 26, 0.02, 9, false),
            cartilage: new TubeGeometry(cartilageCurve, 14, 0.017, 8, false),
            id: `${lvl.id}-${side === 1 ? "l" : "r"}`,
            intercostal: new TubeGeometry(
              new CatmullRomCurve3([
                new Vector3(side * w * 0.72, lvl.y - 0.055, -d * 0.62),
                new Vector3(side * w * 0.98, lvl.y - 0.11, -d * 0.04),
                new Vector3(side * w * 0.76, lvl.y - 0.165, d * 0.54),
              ]),
              20,
              0.014,
              7,
              false
            ),
            showIntercostal: lvl.id !== "r6",
          };
        })
      ),
    []
  );
  useEffect(
    () => () => {
      for (const a of arcs) {
        a.bone.dispose();
        a.cartilage.dispose();
        a.intercostal.dispose();
      }
    },
    [arcs]
  );
  return arcs;
}

/** Builds sculpted sternum bone (manubrium, body, xiphoid) and proximal airway trachea connector. */
export function useAirwayAndSternum() {
  const resources = useMemo(() => {
    const sternum = new LatheGeometry(
      [
        new Vector2(0.002, 0.36),
        new Vector2(0.024, 0.44),
        new Vector2(0.052, 0.66),
        new Vector2(0.058, 0.88),
        new Vector2(0.088, 1.02),
        new Vector2(0.072, 1.12),
        new Vector2(0.002, 1.14),
      ],
      18
    );
    sternum.scale(1, 1, 0.34);

    const leftBronchus = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 1.07, -0.02),
        new Vector3(0.11, 1.0, -0.02),
        new Vector3(0.22, 0.9, -0.01),
      ]),
      14,
      0.042,
      10,
      false
    );
    const rightBronchus = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 1.07, -0.02),
        new Vector3(-0.1, 0.99, -0.02),
        new Vector3(-0.2, 0.88, -0.01),
      ]),
      14,
      0.045,
      10,
      false
    );
    return { leftBronchus, rightBronchus, sternum };
  }, []);
  useEffect(
    () => () => {
      resources.sternum.dispose();
      resources.leftBronchus.dispose();
      resources.rightBronchus.dispose();
    },
    [resources]
  );
  return resources;
}
