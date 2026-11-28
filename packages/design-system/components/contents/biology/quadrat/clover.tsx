import {
  colorizeGeometry,
  placeBlade,
  TURN,
} from "@repo/design-system/components/contents/biology/flora";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, Color, TubeGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The pale chevron across each leaflet of white clover. */
function cloverMark(along: number, across: number) {
  const band = (along - 0.42 - 0.22 * (1 - Math.abs(across))) / 0.07;
  return 0.75 * Math.exp(-band * band);
}

/** One globose clover flower head: dozens of narrow florets, the lowest spent and turned down. */
function cloverHead(centre: Vector3, seed: number) {
  const fresh = new Color(FLORA_COLORS.cloverBloom);
  const blush = new Color(FLORA_COLORS.cloverBlush);
  const spent = new Color(FLORA_COLORS.grassDry);
  return Arr.map(Arr.range(0, 43), (f) => {
    const rise = 1 - (f + 0.5) / 34;
    const pitch = Math.asin(Math.max(-0.85, rise));
    return placeBlade({
      base: f > 36 ? spent : blush,
      columns: 2,
      droop: 0.25,
      heading: f * TURN + hashUnit(seed + f, 3),
      length: 0.021 + hashUnit(seed + f, 5) * 0.006,
      origin: centre,
      outline: "obovate",
      pitch,
      rows: 4,
      tip: f > 36 ? spent : fresh,
      width: 0.0075,
    });
  });
}

/** Builds a patch of white clover: trifoliate leaves with chevrons on long stalks and globose flower heads. */
export function useCloverCluster(seed = 2) {
  const geometry = useMemo(() => {
    const stalk = new Color(FLORA_COLORS.stemGreen);
    const leafBase = new Color(FLORA_COLORS.cloverLeaf);
    const leafTip = new Color(FLORA_COLORS.shrubSun);
    const mark = { at: cloverMark, color: new Color(FLORA_COLORS.cloverMark) };
    const parts = Arr.flatMap(Arr.range(0, 21), (i) => {
      const ang = i * TURN + hashUnit(seed + i, 1) * 0.6;
      const rad = 0.03 + Math.sqrt((i + 0.5) / 22) * 0.2;
      const h = 0.07 + hashUnit(seed + i, 3) * 0.07;
      const bx = Math.cos(ang) * rad;
      const bz = Math.sin(ang) * rad;
      const lean = 0.03 + hashUnit(seed + i, 4) * 0.03;
      const top = new Vector3(
        bx + Math.cos(ang) * lean,
        h,
        bz + Math.sin(ang) * lean
      );
      const petiole = new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(bx, 0, bz),
          new Vector3(bx + Math.cos(ang) * lean * 0.2, h * 0.55, bz),
          top,
        ]),
        8,
        0.0022,
        5,
        false
      );
      const heads =
        i % 7 === 3
          ? cloverHead(top.clone().setY(h + 0.05), seed + i)
          : Arr.map(Arr.range(0, 2), (l) =>
              placeBlade({
                base: leafBase,
                droop: 0.12,
                heading: ang + (l * Math.PI * 2) / 3,
                length: 0.05 + hashUnit(seed + i, 6) * 0.014,
                mark,
                origin: top,
                outline: "obovate",
                pitch: 0.12 + hashUnit(seed + i * 3 + l, 5) * 0.2,
                rows: 8,
                tip: leafTip,
                width: 0.05,
              })
            );
      return [colorizeGeometry(petiole, stalk), ...heads];
    });
    return mergeGeometries(parts);
  }, [seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
