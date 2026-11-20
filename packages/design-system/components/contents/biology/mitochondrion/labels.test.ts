// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  arch,
  INSET,
  sectionRadius,
  swell,
} from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import { LABELS } from "@repo/design-system/components/contents/biology/mitochondrion/labels";
import { compartmentOf } from "@repo/design-system/components/contents/biology/mitochondrion/test/compartment";
import { Array as Arr } from "effect";

describe("the labels", () => {
  it("name every part once, from outside the organelle", () => {
    expect(Arr.map(LABELS, (label) => label.part)).toEqual([
      "cytoplasm",
      "outer",
      "inner",
      "cristae",
      "matrix",
    ]);
    for (const label of LABELS) {
      expect(compartmentOf(label.at)).toBe("cytoplasm");
    }
  });

  it("point each leader at the part it names", () => {
    const target = (part: string) =>
      Arr.findFirst(LABELS, (label) => label.part === part).pipe((found) =>
        found._tag === "Some" ? found.value.target : undefined
      );
    const outer = target("outer");
    const inner = target("inner");
    const matrix = target("matrix");
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect(target("cytoplasm")).toBeUndefined();
    const radial = (point: Point | undefined) =>
      point === undefined ? 0 : Math.hypot(point[1] - arch(point[0]), point[2]);
    const wall = (point: Point | undefined, inset: number) =>
      point === undefined
        ? 0
        : sectionRadius(point[0], inset) * swell(point[0], Math.PI);
    expect(radial(outer)).toBeLessThan(wall(outer, INSET.outer) * 1.04);
    expect(radial(outer)).toBeGreaterThan(wall(outer, INSET.outerBack) * 0.96);
    expect(radial(inner)).toBeLessThan(wall(inner, INSET.inner) * 1.04);
    expect(matrix === undefined ? "" : compartmentOf(matrix)).toBe("matrix");
  });
});
