import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  makePracticeDomainPath,
  makePracticeGroupPath,
} from "@repo/contents/_types/route/practice/group";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("practice group route paths", () => {
  it("builds canonical domain and group paths from source-owned practice rows", () => {
    const material = MATERIAL_SOURCES.find(
      (source) =>
        source.kind === "practice" &&
        source.assessment === "snbt" &&
        source.domain === "quantitative-knowledge"
    );

    if (material?.kind !== "practice") {
      expect.fail("Expected SNBT quantitative knowledge practice material.");
    }

    const group = material.groups.find(
      (candidate) => candidate.exerciseType === "try-out"
    );

    if (!group) {
      expect.fail("Expected a tryout practice group.");
    }

    expect(
      Effect.runSync(
        makePracticeDomainPath({
          domains: MATERIAL_ROUTE_DOMAINS,
          locale: "id",
          material,
        })
      )
    ).toBe("latihan/snbt/pengetahuan-kuantitatif");
    expect(
      Effect.runSync(
        makePracticeGroupPath({
          domains: MATERIAL_ROUTE_DOMAINS,
          group,
          locale: "en",
          material,
        })
      )
    ).toBe("practice/snbt/quantitative-knowledge/tryout-2026");
  });
});
