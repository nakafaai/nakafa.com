import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  bodyPoint,
  CRISTAE,
  cristaPoint,
  gapPoint,
  INSET,
  MEMBRANE,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import { Array as Arr, Match, Schema } from "effect";

/**
 * The 3D labels of the scene: which parts it names, where each label stands,
 * which way it reads from there, and the point its leader runs to.
 */

/** The parts the scene names. */
export const PartSchema = Schema.Literals([
  "cytoplasm",
  "outer",
  "inner",
  "cristae",
  "matrix",
]);
export type Part = typeof PartSchema.Type;

/** A membrane's middle at `along` on the top (`top`) or bottom edge of the cut. */
function edgePoint(along: number, top: boolean, inset: number): Point {
  return bodyPoint(along, top ? 2 * Math.PI : Math.PI, inset + MEMBRANE / 2);
}

/** `point` moved by `x` and `y` in the plane of the cut. */
function beside(point: Point, x: number, y: number): Point {
  return [point[0] + x, point[1] + y, 0];
}

/**
 * Where each part's label stands, which way it reads from there, and the
 * point its leader runs to: the outer membrane's top cut edge, the inner
 * membrane's bottom cut edge, the cut through a crista, the matrix of a quiet
 * end gap, and open cytoplasm, which needs no leader. The labels keep to the
 * calm sides of the organelle, clear of the molecules' paths.
 */
export const LABELS = Arr.map(PartSchema.literals, (part) =>
  Match.value(part).pipe(
    Match.when("outer", () => {
      const target = edgePoint(0.78, true, INSET.outer);
      return {
        anchor: ["center", "bottom"] as const,
        at: beside(target, 0.18, 0.5),
        part,
        target,
      };
    }),
    Match.when("inner", () => {
      const target = edgePoint(0.66, false, INSET.inner);
      return {
        anchor: ["center", "top"] as const,
        at: beside(target, 0.12, -0.5),
        part,
        target,
      };
    }),
    Match.when("cristae", () => {
      const target = cristaPoint(Arr.getUnsafe(CRISTAE, 2), Math.PI, 0.6, 0);
      return {
        anchor: ["center", "top"] as const,
        at: beside(target, -0.25, -0.62),
        part,
        target,
      };
    }),
    Match.when("matrix", () => {
      const target = gapPoint(7, 1.62 * Math.PI, 0.2);
      return {
        anchor: ["left", "middle"] as const,
        at: beside(target, 0.62, -0.12),
        part,
        target,
      };
    }),
    Match.when("cytoplasm", () => {
      const at: Point = [-1.55, -0.12, 0];
      return {
        anchor: ["center", "middle"] as const,
        at,
        part,
        target: undefined,
      };
    }),
    Match.exhaustive
  )
);
