// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  armPairAt,
  legPairFor,
} from "@repo/design-system/components/contents/biology/limb/model";

describe("muscle pair lab model", () => {
  it("swaps biceps and triceps roles across elbow flexion and extension", () => {
    expect(armPairAt(55)).toEqual({
      contracting: "biceps",
      relaxing: "triceps",
    });
    expect(armPairAt(150)).toEqual({
      contracting: "triceps",
      relaxing: "biceps",
    });
  });

  it("maps every knee and ankle movement to its exact antagonistic pair", () => {
    expect(legPairFor("heel")).toEqual({
      contracting: "gastrocnemius",
      relaxing: "tibialis",
    });
    expect(legPairFor("toes")).toEqual({
      contracting: "tibialis",
      relaxing: "gastrocnemius",
    });
    expect(legPairFor("bend")).toEqual({
      contracting: "hamstrings",
      relaxing: "quadriceps",
    });
    expect(legPairFor("straighten")).toEqual({
      contracting: "quadriceps",
      relaxing: "hamstrings",
    });
  });
});
