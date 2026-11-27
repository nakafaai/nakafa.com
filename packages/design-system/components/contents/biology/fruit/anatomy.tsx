import { leafBlade } from "@repo/design-system/components/contents/biology/flora";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function paintVerticalGradient(
  geo: LatheGeometry,
  bottomColor: string,
  topColor: string,
  yMin: number,
  yMax: number
) {
  const pos = geo.attributes.position;
  const c0 = new Color(bottomColor);
  const c1 = new Color(topColor);
  const tmp = new Color();
  const colors = new Float32Array(pos.count * 3);
  const span = Math.max(0.001, yMax - yMin);
  for (let i = 0; i < pos.count; i += 1) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - yMin) / span));
    tmp.copy(c0).lerp(c1, t);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geo;
}

/** Sculpted geometries for simple drupe, aggregate raspberry, multiple pineapple, and magnified dicot seed cutaway. */
export function useFruitSeedGeometries() {
  const geos = useMemo(() => {
    // 1. Simple drupe (peach cutaway facing +Z).
    const peachProfile = Arr.map(Arr.range(0, 22), (s) => {
      const t = s / 22;
      const y = (t - 0.5) * 0.62;
      const baseR = Math.sin(t * Math.PI) ** 0.78 * 0.31;
      const shoulder = 1 + 0.08 * Math.sin(t * Math.PI * 2);
      const cleft = t > 0.88 ? 0.85 : 1;
      return new Vector2(Math.max(0.004, baseR * shoulder * cleft), y);
    });
    const peachSkin = paintVerticalGradient(
      new LatheGeometry(peachProfile, 36, Math.PI * 0.27, Math.PI * 1.46),
      BOTANY_COLORS.pericarpPeach,
      BOTANY_COLORS.fruitCoral,
      -0.31,
      0.31
    );

    // Solid inner mesocarp wedge caps fitting flush inside the peach skin cutaway.
    const fleshShape = new Shape();
    fleshShape.moveTo(0.08, -0.27);
    for (let s = 1; s <= 20; s += 1) {
      const t = s / 20;
      const y = (t - 0.5) * 0.58;
      const r =
        Math.sin(t * Math.PI) ** 0.78 *
        0.285 *
        (1 + 0.08 * Math.sin(t * Math.PI * 2));
      fleshShape.lineTo(Math.max(0.085, r), y);
    }
    fleshShape.lineTo(0.08, 0.27);
    fleshShape.quadraticCurveTo(0.13, 0, 0.08, -0.27);
    const fleshWall = new ExtrudeGeometry(fleshShape, {
      bevelEnabled: false,
      depth: 0.014,
    });

    // Corrugated woody endocarp stone pit.
    const pitProfile = Arr.map(Arr.range(0, 16), (s) => {
      const t = s / 16;
      const y = (t - 0.5) * 0.28;
      const r = Math.max(
        0.003,
        Math.sin(t * Math.PI) ** 0.85 * 0.115 * (1 - t * 0.18)
      );
      return new Vector2(r, y);
    });
    const pit = new LatheGeometry(pitProfile, 24);
    const pitPos = pit.attributes.position;
    for (let i = 0; i < pitPos.count; i += 1) {
      const px = pitPos.getX(i);
      const py = pitPos.getY(i);
      const pz = pitPos.getZ(i);
      const ang = Math.atan2(pz, px);
      const ridge = 1 + 0.09 * Math.sin(ang * 9 + py * 14);
      pitPos.setXYZ(i, px * ridge, py, pz * ridge);
    }
    pit.computeVertexNormals();

    // Curved woody fruit pedicel + botanical peach leaf.
    const pedicel = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(0, 0.27, 0),
        new Vector3(0.02, 0.37, -0.02),
        new Vector3(0.08, 0.45, -0.03),
      ]),
      14,
      0.016,
      8,
      false
    );
    const peachLeaf = leafBlade(
      new Vector3(0.03, 0.36, -0.01),
      2.65,
      0.16,
      0.34,
      0.11,
      0.05,
      7,
      new Color(BOTANY_COLORS.sepalGreen),
      new Color(BOTANY_COLORS.healthyLeaf)
    );

    // 2. Aggregate fruit (raspberry drupelet dome + calyx skirt).
    const drupeletCoords = Arr.flatMap(
      [
        { count: 7, r: 0.17, y: -0.1 },
        { count: 6, r: 0.15, y: 0.04 },
        { count: 5, r: 0.095, y: 0.17 },
      ],
      (tier, tierIdx) =>
        Arr.makeBy(tier.count, (idx) => {
          const ang = (idx / tier.count) * Math.PI * 2 + tierIdx * 0.45;
          return {
            id: `dr-${tierIdx}-${idx}`,
            x: Math.cos(ang) * tier.r,
            y: tier.y,
            z: Math.sin(ang) * tier.r,
          };
        })
    );
    const berryCalyx = mergeGeometries(
      Arr.makeBy(5, (i) =>
        leafBlade(
          new Vector3(0, -0.18, 0),
          (i / 5) * Math.PI * 2 + 0.2,
          -0.06,
          0.24,
          0.075,
          -0.04,
          5,
          new Color(BOTANY_COLORS.sepalGreen),
          new Color(BOTANY_COLORS.healthyLeaf)
        )
      )
    );

    // 3. Multiple fruit (pineapple syncarp body + spiral eyes + spiky leaf crown).
    const pineProfile = Arr.map(Arr.range(0, 18), (s) => {
      const t = s / 18;
      const y = -0.3 + t * 0.6;
      const r = Math.max(0.008, Math.sin(t * Math.PI) ** 0.68 * 0.24);
      return new Vector2(r, y);
    });
    const pineCore = paintVerticalGradient(
      new LatheGeometry(pineProfile, 24),
      BOTANY_COLORS.agarAmber,
      BOTANY_COLORS.cotyledonGold,
      -0.3,
      0.3
    );
    const pineEyes = Arr.makeBy(28, (i) => {
      const t = (i + 1) / 29;
      const y = -0.24 + t * 0.48;
      const r = Math.sin(t * Math.PI) ** 0.68 * 0.235;
      const ang = i * 2.399_96;
      return {
        ang,
        id: `pe-${i}`,
        x: Math.cos(ang) * r,
        y,
        z: Math.sin(ang) * r,
      };
    });
    const pineCrown = mergeGeometries(
      Arr.makeBy(11, (i) => {
        const ring = i < 6 ? 0 : 1;
        const yaw = (i / (ring === 0 ? 6 : 5)) * Math.PI * 2 + ring * 0.55;
        return leafBlade(
          new Vector3(0, 0.28 + ring * 0.04, 0),
          yaw,
          ring === 0 ? 0.26 : 0.34,
          ring === 0 ? 0.32 : 0.26,
          0.068,
          0.04,
          6,
          new Color(BOTANY_COLORS.sepalGreen),
          new Color(BOTANY_COLORS.healthyLeaf)
        );
      })
    );

    // 4. Magnified dicot kidney-bean seed cutaway facing +Z.
    const beanShape = new Shape();
    beanShape.moveTo(-0.08, -0.22);
    beanShape.bezierCurveTo(-0.28, -0.26, -0.34, 0.02, -0.24, 0.2);
    beanShape.bezierCurveTo(-0.1, 0.32, 0.24, 0.28, 0.3, 0.06);
    beanShape.bezierCurveTo(0.34, -0.14, 0.16, -0.28, -0.02, -0.18);
    beanShape.quadraticCurveTo(-0.06, -0.16, -0.08, -0.22);
    const testaShell = new ExtrudeGeometry(beanShape, {
      bevelEnabled: true,
      bevelSegments: 5,
      bevelSize: 0.045,
      bevelThickness: 0.06,
      depth: 0.08,
    });
    testaShell.translate(0, 0, -0.07);

    const endospermShape = new Shape();
    endospermShape.moveTo(-0.18, 0.04);
    endospermShape.bezierCurveTo(-0.2, 0.2, 0.06, 0.24, 0.2, 0.14);
    endospermShape.bezierCurveTo(0.24, 0.04, 0.12, -0.04, -0.04, -0.02);
    endospermShape.quadraticCurveTo(-0.16, -0.01, -0.18, 0.04);
    const endosperm = new ExtrudeGeometry(endospermShape, {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.024,
      bevelThickness: 0.032,
      depth: 0.045,
    });
    endosperm.translate(0, 0, 0.015);

    const cotyledonShape = new Shape();
    cotyledonShape.moveTo(-0.02, -0.14);
    cotyledonShape.bezierCurveTo(0.14, -0.2, 0.26, -0.08, 0.22, 0.06);
    cotyledonShape.bezierCurveTo(0.16, 0.14, 0.0, 0.1, -0.06, -0.02);
    cotyledonShape.quadraticCurveTo(-0.08, -0.1, -0.02, -0.14);
    const cotyledon = new ExtrudeGeometry(cotyledonShape, {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 0.022,
      bevelThickness: 0.03,
      depth: 0.042,
    });
    cotyledon.translate(0, 0, 0.035);

    // Sculpted J-curved embryo axis (radicle + hypocotyl + plumule leaflets).
    const embryoAxis = new TubeGeometry(
      new CatmullRomCurve3([
        new Vector3(-0.06, 0.05, 0.095),
        new Vector3(-0.14, -0.01, 0.105),
        new Vector3(-0.15, -0.1, 0.102),
        new Vector3(-0.09, -0.17, 0.095),
      ]),
      18,
      0.026,
      10,
      false
    );
    const plumuleLeaves = mergeGeometries([
      leafBlade(
        new Vector3(-0.06, 0.05, 0.095),
        0.55,
        0.04,
        0.09,
        0.038,
        0.02,
        5,
        new Color(BOTANY_COLORS.embryoGreen),
        new Color(BOTANY_COLORS.healthyLeaf)
      ),
      leafBlade(
        new Vector3(-0.06, 0.05, 0.095),
        1.45,
        0.05,
        0.085,
        0.036,
        0.02,
        5,
        new Color(BOTANY_COLORS.embryoGreen),
        new Color(BOTANY_COLORS.healthyLeaf)
      ),
    ]);

    return {
      berryCalyx,
      cotyledon,
      drupeletCoords,
      embryoAxis,
      endosperm,
      fleshWall,
      peachLeaf,
      peachSkin,
      pedicel,
      pineCore,
      pineCrown,
      pineEyes,
      pit,
      plumuleLeaves,
      testaShell,
    };
  }, []);

  useEffect(
    () => () => {
      geos.berryCalyx.dispose();
      geos.cotyledon.dispose();
      geos.embryoAxis.dispose();
      geos.endosperm.dispose();
      geos.fleshWall.dispose();
      geos.peachLeaf.dispose();
      geos.peachSkin.dispose();
      geos.pedicel.dispose();
      geos.pineCore.dispose();
      geos.pineCrown.dispose();
      geos.pit.dispose();
      geos.plumuleLeaves.dispose();
      geos.testaShell.dispose();
    },
    [geos]
  );

  return geos;
}
