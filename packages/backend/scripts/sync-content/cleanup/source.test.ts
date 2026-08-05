import { collectFilesystemArticleCurriculumSlugs } from "@repo/backend/scripts/sync-content/cleanup/source";
import { listLessonRows } from "@repo/contents/_types/material/registry";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/scripts/sync-content/runtime/files", () => ({
  globFiles: vi.fn(() => Effect.succeed([])),
}));

describe("content cleanup source inventory", () => {
  it("reports only Nakafa-owned article and curriculum sources", async () => {
    const slugs = await Effect.runPromise(
      collectFilesystemArticleCurriculumSlugs()
    );

    expect(slugs).toEqual({
      articleSlugs: [],
      curriculumLessonSlugs: [],
      curriculumTopicSlugs: listLessonRows().map((topic) => topic.slug),
    });
  });
});
