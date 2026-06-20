import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  createPracticeMaterialByKey,
  isPracticeMaterialSource,
} from "@repo/contents/_types/route/practice/material";
import { describe, expect, it } from "vitest";

describe("practice material route index", () => {
  it("indexes only practice materials by stable material key", () => {
    const practice = MATERIAL_SOURCES.find(
      (source) =>
        source.kind === "practice" &&
        source.key === "practice.assessment.snbt.quantitative-knowledge"
    );
    const lesson = MATERIAL_SOURCES.find((source) => source.kind === "lesson");

    if (!(practice && lesson)) {
      expect.fail("Expected practice and lesson material fixtures.");
    }

    const materialByKey = createPracticeMaterialByKey(MATERIAL_SOURCES);

    expect(isPracticeMaterialSource(practice)).toBe(true);
    expect(isPracticeMaterialSource(lesson)).toBe(false);
    expect(materialByKey.get(practice.key)).toBe(practice);
    expect(materialByKey.has(lesson.key)).toBe(false);
  });
});
