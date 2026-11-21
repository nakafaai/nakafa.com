import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  arch,
  INSET,
  sectionRadius,
  swell,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";

/**
 * Which compartment `point` lies in, judged by its distance from the axis:
 * the cytoplasm outside the outer membrane, the intermembrane space within
 * the membranes, or the matrix. The tests read it to check where the model
 * puts each body and molecule.
 */
export function compartmentOf([x, y, z]: Point) {
  const radial = Math.hypot(y - arch(x), z);
  const theta = Math.atan2(z, y - arch(x));
  const scale = swell(x, theta < 0 ? theta + 2 * Math.PI : theta);
  if (radial >= sectionRadius(x, INSET.outer) * scale) {
    return "cytoplasm";
  }
  return radial >= sectionRadius(x, INSET.matrix) * scale
    ? "intermembrane"
    : "matrix";
}
