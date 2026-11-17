// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  pollinationNeeds,
  seedChromosomes,
  stageAt,
  stageProgress,
} from "@repo/design-system/components/contents/biology/fertilisation/gametes";

describe("double fertilisation", () => {
  it("counts the chromosomes of a tetraploid mother crossed with a diploid father", () => {
    expect(seedChromosomes(48, 24)).toEqual({
      egg: 24,
      embryo: 36,
      endosperm: 60,
      seedCoat: 48,
      sperm: 12,
    });
  });

  it("needs one pollen grain and two male gametes for every ovule", () => {
    expect(pollinationNeeds(30)).toEqual({ gametes: 60, grains: 30 });
  });

  it("runs through the stages in order", () => {
    expect(stageAt(0)).toBe("pollination");
    expect(stageAt(0.3)).toBe("tube");
    expect(stageAt(0.7)).toBe("entry");
    expect(stageAt(1)).toBe("fusion");
    expect(stageProgress("tube", 0.12)).toBe(0);
    expect(stageProgress("tube", 0.9)).toBe(1);
    expect(stageProgress("fusion", 0.89)).toBeCloseTo(0.5, 12);
  });
});
