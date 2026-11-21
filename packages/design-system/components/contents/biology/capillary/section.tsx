import {
  ARTERIOLE,
  inner,
  outer,
  VENULE,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import type { Axis } from "@repo/design-system/components/contents/biology/capillary/sweep";
import { pointOn } from "@repo/design-system/components/contents/biology/capillary/sweep";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";

/** The colours of a cut through a vessel's wall, as a stained section shows them, for a point `r` from the axis and turned `angle`. */
type Paint = (r: number, angle: number, into: Color) => Color;

const SECTION = {
  adventitia: new Color(CAPILLARY_COLORS.adventitia),
  intima: new Color(CAPILLARY_COLORS.intima),
  lamina: new Color(CAPILLARY_COLORS.lamina),
  muscle: new Color(CAPILLARY_COLORS.muscle),
  muscleDeep: new Color(CAPILLARY_COLORS.muscleDeep),
  nucleus: new Color(CAPILLARY_COLORS.muscleNucleus),
  venule: new Color(CAPILLARY_COLORS.venuleWall),
};

/**
 * The arteriole in section, from the lumen out: a thin endothelium, the
 * bright wavy internal elastic lamina, a thick media of smooth muscle whose
 * cigar-shaped nuclei run round the vessel, and a pale fibrous adventitia.
 */
export function arteriolePaint(r: number, angle: number, into: Color) {
  const lumen = inner(ARTERIOLE);
  const wall = outer(ARTERIOLE) - lumen;
  const depth = (r - lumen) / wall;
  const lamina = 0.07 + 0.015 * Math.sin(angle * 46);
  if (depth < 0.04) {
    return into.copy(SECTION.intima);
  }
  if (depth < lamina) {
    return into.copy(SECTION.lamina);
  }
  if (depth > 0.82) {
    return into
      .copy(SECTION.adventitia)
      .lerp(SECTION.muscle, 0.25 * hashUnit(Math.floor(angle * 30), 4));
  }
  const row = Math.floor((depth - lamina) / 0.18);
  const slot = (angle * r) / 0.55 + hashUnit(row, 2) * 3;
  const cellIndex = Math.floor(slot);
  const inSlot = slot - cellIndex - 0.5;
  const rowCentre = lamina + (row + 0.5) * 0.18;
  const nucleus =
    (inSlot / 0.32) ** 2 + (((depth - rowCentre) * wall) / 0.045) ** 2 < 1 &&
    hashUnit(cellIndex, row) < 0.55;
  if (nucleus) {
    return into.copy(SECTION.nucleus);
  }
  return into
    .copy(SECTION.muscle)
    .lerp(SECTION.muscleDeep, 0.5 * hashUnit(cellIndex, row + 7));
}

/** The venule in section: a thin wall of endothelium and a few pericytes. */
export function venulePaint(r: number, angle: number, into: Color) {
  const nucleus =
    hashUnit(Math.floor(angle * 5), 9) < 0.3 && r < inner(VENULE) + 0.12;
  return nucleus ? into.copy(SECTION.nucleus) : into.copy(SECTION.venule);
}

/**
 * The face where the block's cut crosses a vessel at the end of `axis`
 * (`end` 0 for its start, 1 for its end): a ring from the lumen to the outer
 * wall, painted as a stained section.
 */
export function useCutFace(axis: Axis, lumen: number, paint: Paint, end = 0) {
  const geometry = useMemo(() => {
    const radial = 192;
    const bands = 28;
    const outerRadius = axis.radius[end * axis.steps] ?? lumen;
    const positions = new Float32Array((bands + 1) * (radial + 1) * 3);
    const colors = new Float32Array((bands + 1) * (radial + 1) * 3);
    const point = new Vector3();
    const color = new Color();
    for (const band of Arr.range(0, bands)) {
      const r = lumen + ((outerRadius - lumen) * band) / bands;
      for (const turn of Arr.range(0, radial)) {
        const angle = (turn / radial) * Math.PI * 2;
        const index = band * (radial + 1) + turn;
        pointOn(axis, end, r, angle, point).toArray(positions, index * 3);
        paint(r, angle, color).toArray(colors, index * 3);
      }
    }
    const indices = Arr.flatMap(Arr.range(0, bands - 1), (band) =>
      Arr.flatMap(Arr.range(0, radial - 1), (turn) => {
        const a = band * (radial + 1) + turn;
        const b = a + radial + 1;
        return [a, a + 1, b, b, a + 1, b + 1];
      })
    );
    const ring = new BufferGeometry();
    ring.setAttribute("position", new BufferAttribute(positions, 3));
    ring.setAttribute("color", new BufferAttribute(colors, 3));
    ring.setIndex(indices);
    ring.computeVertexNormals();
    return ring;
  }, [axis, end, lumen, paint]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}
