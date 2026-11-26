import { leafBlade } from "@repo/design-system/components/contents/biology/flora";
import type { PollinationMode } from "@repo/design-system/components/contents/biology/flower/model";
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

/** Sculpted botanical flower whorls: cupped petals, recurved sepals, cutaway ovary, curving stamens, feathery stigma. */
export function useFlowerGeometries(
  mode: PollinationMode,
  petalScale: number,
  filamentLength: number
) {
  const geos = useMemo(() => {
    // Swollen floral receptacle + pedicel base.
    const recepPts = [
      new Vector2(0.048, 0),
      new Vector2(0.044, 0.24),
      new Vector2(0.088, 0.32),
      new Vector2(0.115, 0.36),
      new Vector2(0.002, 0.38),
    ];
    const receptacle = new LatheGeometry(recepPts, 24);

    // 5 gracefully recurved calyx sepals around the receptacle.
    const sepalBase = new Color(BOTANY_COLORS.sepalGreen);
    const sepalTip = new Color(BOTANY_COLORS.healthyLeaf);
    const sepals = mergeGeometries(
      Arr.makeBy(5, (i) =>
        leafBlade(
          new Vector3(0, 0.33, 0),
          (i / 5) * Math.PI * 2 + 0.3,
          0.02,
          0.32,
          0.09,
          -0.06,
          6,
          sepalBase,
          sepalTip
        )
      )
    );

    // 5 sculpted curved silky cupped petals framing the carpel cleanly from behind.
    const petalBase = new Color(
      mode === "insect" ? BOTANY_COLORS.stigmaRose : BOTANY_COLORS.sepalGreen
    );
    const petalTip = new Color(
      mode === "insect" ? BOTANY_COLORS.flowerPink : BOTANY_COLORS.windGreen
    );
    const petals = mergeGeometries(
      Arr.makeBy(5, (i) => {
        const yaw = -Math.PI * 0.86 + (i / 4) * Math.PI * 0.72;
        return leafBlade(
          new Vector3(0, 0.35, -0.05),
          yaw,
          0.62 * petalScale,
          0.46 * petalScale,
          0.32 * petalScale,
          -0.06 * petalScale,
          9,
          petalBase,
          petalTip
        );
      })
    );

    // Pear-shaped translucent carpel ovary with anterior cutaway window showing inner ovules.
    const ovaryPts = Arr.map(Arr.range(0, 18), (s) => {
      const t = s / 18;
      const r = Math.max(
        0.004,
        0.165 * Math.sin(t * Math.PI) ** 0.72 * (1 - t * 0.32)
      );
      return new Vector2(r, t * 0.34);
    });
    const ovaryShell = new LatheGeometry(
      ovaryPts,
      28,
      Math.PI * 0.28,
      Math.PI * 1.44
    );

    // Curving paired stamens (4 filaments arching gracefully outward).
    const stamenAngles = [-0.72, -0.26, 0.26, 0.72] as const;
    const stamens = Arr.map(stamenAngles, (ang) => {
      const dir = ang >= 0 ? 1 : -1;
      const spread = Math.abs(ang) * (mode === "wind" ? 0.56 : 0.44);
      const topY = 0.38 + filamentLength * (mode === "wind" ? 1.05 : 0.92);
      const tip = new Vector3(
        dir * spread,
        topY,
        -0.02 + (Math.abs(ang) > 0.5 ? -0.06 : 0.04)
      );
      const curve = new CatmullRomCurve3([
        new Vector3(dir * 0.06, 0.36, 0),
        new Vector3(
          dir * spread * 0.72,
          0.36 + filamentLength * 0.55,
          tip.z * 0.5
        ),
        tip,
      ]);
      return {
        filament: new TubeGeometry(curve, 18, 0.013, 8, false),
        id: `st-${ang}`,
        tip: [tip.x, tip.y, tip.z] as const,
      };
    });

    // Delicate feathery plumose stigma branches for wind pollination.
    const plumoseBranches = Arr.makeBy(8, (i) => {
      const a = (i / 8) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      return {
        geo: new TubeGeometry(
          new CatmullRomCurve3([
            new Vector3(0, 0, 0),
            new Vector3(dx * 0.1, 0.04, dz * 0.06),
            new Vector3(dx * 0.19, 0.02, dz * 0.1),
          ]),
          10,
          0.008,
          6,
          false
        ),
        id: `pl-${i}`,
      };
    });

    return { ovaryShell, petals, plumoseBranches, receptacle, sepals, stamens };
  }, [filamentLength, mode, petalScale]);

  useEffect(
    () => () => {
      geos.receptacle.dispose();
      geos.sepals.dispose();
      geos.petals.dispose();
      geos.ovaryShell.dispose();
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
