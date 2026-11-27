import { describe, expect, it } from "@effect/vitest";
import {
  BENCH,
  cellCentres,
  circuitLeads,
  ELECTRODE_TOP,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";

const posts = [
  [-0.05, 0.12, -0.14],
  [0.05, 0.12, -0.14],
] as const;
const top = ELECTRODE_TOP * BENCH;

describe("electrolysis circuit", () => {
  it("centres one cell under the power pack and spreads two either side", () => {
    expect(cellCentres(1)).toEqual([0]);
    expect(cellCentres(2)).toEqual([-0.8, 0.8]);
  });

  it("runs one cell's leads from its anode's clip to the positive post and from the negative post to its cathode's clip", () => {
    const leads = circuitLeads(1, posts);

    expect(leads).toHaveLength(2);
    expect(leads[0].ends).toEqual(["clip", "plug"]);
    expect(leads[0].from[0]).toBeCloseTo(-0.02);
    expect(leads[0].from[1]).toBeCloseTo(top);
    expect(leads[0].to).toEqual(posts[0]);
    expect(leads[1]?.ends).toEqual(["plug", "clip"]);
    expect(leads[1]?.from).toEqual(posts[1]);
    expect(leads[1]?.to[0]).toBeCloseTo(0.02);
  });

  it("links the second cell's anode to the first cell's cathode in series, clip to clip", () => {
    const leads = circuitLeads(2, posts);

    expect(leads).toHaveLength(3);
    expect(leads[1]?.ends).toEqual(["clip", "clip"]);
    expect(leads[1]?.from[0]).toBeCloseTo(0.06);
    expect(leads[1]?.to[0]).toBeCloseTo(-0.06);
    expect(leads[1]?.lift).toBeLessThan(leads[0].lift);
  });
});
