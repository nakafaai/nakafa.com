import { leafBlade } from "@repo/design-system/components/contents/biology/flora";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Sculpted terracotta pot, organic curved stem, veined botanical leaves, calyx, and apical shoot buds. */
export function useHormoneBotanyGeometries(
  stemHeight: number,
  yellowLeaf: boolean
) {
  const staticGeos = useMemo(() => {
    // Authentic rolled-lip terracotta planter pot.
    const potPts = [
      new Vector2(0.002, 0),
      new Vector2(0.24, 0),
      new Vector2(0.29, 0.22),
      new Vector2(0.32, 0.24),
      new Vector2(0.32, 0.285),
      new Vector2(0.285, 0.285),
      new Vector2(0.275, 0.23),
      new Vector2(0.002, 0.22),
    ];
    const pot = new LatheGeometry(potPts, 32);

    // Sculpted glossy tomato / fleshy berry fruit with gentle ribbed botanical shoulder.
    const fruitPts = Arr.map(Arr.range(0, 18), (s) => {
      const t = s / 18;
      const y = (t - 0.5) * 0.2;
      const r = Math.max(
        0.003,
        Math.sin(t * Math.PI) ** 0.72 *
          0.118 *
          (1 + 0.08 * Math.sin(t * Math.PI * 2))
      );
      return new Vector2(r, y);
    });
    const fruit = new LatheGeometry(fruitPts, 28);

    // 5-pointed green star calyx crowning the fruit.
    const calyxBase = new Color(BOTANY_COLORS.sepalGreen);
    const calyxTip = new Color(BOTANY_COLORS.healthyLeaf);
    const calyx = mergeGeometries(
      Arr.makeBy(5, (i) =>
        leafBlade(
          new Vector3(0, 0.095, 0),
          (i / 5) * Math.PI * 2,
          0.02,
          0.075,
          0.022,
          -0.02,
          4,
          calyxBase,
          calyxTip
        )
      )
    );

    // Unfurling young apical shoot bud leaves cupping the apical meristem.
    const budLeaves = mergeGeometries(
      Arr.makeBy(4, (i) =>
        leafBlade(
          new Vector3(0, -0.02, 0),
          (i / 4) * Math.PI * 2 + 0.5,
          0.16,
          0.14,
          0.06,
          0.03,
          6,
          new Color(BOTANY_COLORS.sepalGreen),
          new Color(BOTANY_COLORS.windGreen)
        )
      )
    );

    // Sculpted lateral axillary shoot sprig.
    const lateralSprig = mergeGeometries([
      leafBlade(
        new Vector3(0, 0, 0),
        0,
        0.16,
        0.18,
        0.055,
        0.04,
        6,
        new Color(BOTANY_COLORS.sepalGreen),
        new Color(BOTANY_COLORS.healthyLeaf)
      ),
      leafBlade(
        new Vector3(0.02, 0.01, 0),
        0.55,
        0.14,
        0.14,
        0.042,
        0.03,
        5,
        new Color(BOTANY_COLORS.healthyLeaf),
        new Color(BOTANY_COLORS.windGreen)
      ),
      leafBlade(
        new Vector3(0.02, 0.01, 0),
        -0.55,
        0.14,
        0.14,
        0.042,
        0.03,
        5,
        new Color(BOTANY_COLORS.healthyLeaf),
        new Color(BOTANY_COLORS.windGreen)
      ),
    ]);

    return { budLeaves, calyx, fruit, lateralSprig, pot };
  }, []);

  const dynamicGeos = useMemo(() => {
    const stemCurve = new CatmullRomCurve3([
      new Vector3(0, 0.22, 0),
      new Vector3(-0.02, 0.22 + stemHeight * 0.35, 0.01),
      new Vector3(0.015, 0.22 + stemHeight * 0.7, -0.01),
      new Vector3(0, 0.22 + stemHeight, 0),
    ]);
    const stem = new TubeGeometry(stemCurve, 28, 0.034, 14, false);
    const sp = stem.attributes.position;
    for (let i = 0; i < sp.count; i += 1) {
      const py = sp.getY(i);
      const t = Math.min(
        1,
        Math.max(0, (py - 0.22) / Math.max(0.1, stemHeight))
      );
      const taper = 1.08 - t * 0.42;
      const center = stemCurve.getPoint(t);
      sp.setXYZ(
        i,
        center.x + (sp.getX(i) - center.x) * taper,
        py,
        center.z + (sp.getZ(i) - center.z) * taper
      );
    }
    stem.computeVertexNormals();

    const pedicel = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0.01, 0.22 + stemHeight * 0.72, 0),
        new Vector3(0.14, 0.22 + stemHeight * 0.78, 0.05),
        new Vector3(0.24, 0.22 + stemHeight * 0.68, 0.08),
      ]),
      14,
      0.012,
      8,
      false
    );

    const leafBase = new Color(
      yellowLeaf ? BOTANY_COLORS.chlorosisYellow : BOTANY_COLORS.sepalGreen
    );
    const leafTip = new Color(
      yellowLeaf ? BOTANY_COLORS.necrosisEdge : BOTANY_COLORS.healthyLeaf
    );
    const mainLeaf = mergeGeometries([
      leafBlade(
        new Vector3(0, 0, 0),
        Math.PI * 0.86,
        0.16,
        0.46,
        0.22,
        0.12,
        8,
        leafBase,
        leafTip
      ),
      leafBlade(
        new Vector3(0, -0.06, -0.02),
        Math.PI * 1.18,
        0.14,
        0.38,
        0.19,
        0.1,
        7,
        leafBase,
        leafTip
      ),
    ]);
    const lowerLeaf = mergeGeometries([
      leafBlade(
        new Vector3(0, 0, 0),
        Math.PI * 0.68,
        0.12,
        0.38,
        0.19,
        0.1,
        7,
        leafBase,
        leafTip
      ),
      leafBlade(
        new Vector3(0.01, -0.04, -0.03),
        -0.55,
        0.1,
        0.32,
        0.16,
        0.09,
        6,
        leafBase,
        leafTip
      ),
    ]);

    return { lowerLeaf, mainLeaf, pedicel, stem };
  }, [stemHeight, yellowLeaf]);

  useEffect(
    () => () => {
      staticGeos.pot.dispose();
      staticGeos.fruit.dispose();
      staticGeos.calyx.dispose();
      staticGeos.budLeaves.dispose();
      staticGeos.lateralSprig.dispose();
    },
    [staticGeos]
  );

  useEffect(
    () => () => {
      dynamicGeos.stem.dispose();
      dynamicGeos.pedicel.dispose();
      dynamicGeos.mainLeaf.dispose();
      dynamicGeos.lowerLeaf.dispose();
    },
    [dynamicGeos]
  );

  return { ...staticGeos, ...dynamicGeos };
}
