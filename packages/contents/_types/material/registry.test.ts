import {
  listLessonMaterialSources,
  listLessonRows,
} from "@repo/contents/_types/material/registry";
import { locales } from "@repo/utilities/locales";
import { describe, expect, it } from "vitest";

describe("material registry", () => {
  it("projects sync-ready lesson rows for every supported content language", () => {
    const lessonSources = listLessonMaterialSources();
    const lessonRows = listLessonRows();

    expect(lessonSources.length).toBeGreaterThan(0);
    expect(lessonSources.every((material) => material.kind === "lesson")).toBe(
      true
    );

    for (const locale of locales) {
      expect(lessonRows.some((lesson) => lesson.locale === locale)).toBe(true);
    }

    expect(listLessonRows("id").every((lesson) => lesson.locale === "id")).toBe(
      true
    );
  });
});
