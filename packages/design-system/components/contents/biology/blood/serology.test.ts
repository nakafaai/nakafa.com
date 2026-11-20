// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Sample } from "@repo/design-system/components/contents/biology/blood/serology";
import {
  agglutinates,
  groupOf,
  rhesusSign,
  SERA,
} from "@repo/design-system/components/contents/biology/blood/serology";
import { Array as Arr } from "effect";

/** Which of anti-A, anti-B and anti-D clump a sample's cells, in the tile's order. */
function row(sample: Sample) {
  return Arr.map(SERA, (serum) => agglutinates(serum, sample));
}

describe("blood typing with antisera", () => {
  it("clumps a drop only where the serum meets its antigen", () => {
    expect(row({ group: "A", name: "Ali", rhesus: "positive" })).toEqual([
      true,
      false,
      true,
    ]);
    expect(row({ group: "B", name: "Siti", rhesus: "negative" })).toEqual([
      false,
      true,
      false,
    ]);
    expect(row({ group: "AB", name: "Ravi", rhesus: "positive" })).toEqual([
      true,
      true,
      true,
    ]);
    expect(row({ group: "O", name: "Mei", rhesus: "negative" })).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("reads every group and Rhesus factor back from its three reactions", () => {
    for (const group of ["A", "B", "AB", "O"] as const) {
      for (const rhesus of ["positive", "negative"] as const) {
        const sample = { group, name: "Test", rhesus };
        const [a, b, d] = row(sample);
        expect(groupOf({ a, b, d })).toEqual({ group, rhesus });
      }
    }
  });

  it("writes the Rhesus factor as a plus or a true minus sign", () => {
    expect(rhesusSign("positive")).toBe("+");
    expect(rhesusSign("negative")).toBe("−");
  });
});
