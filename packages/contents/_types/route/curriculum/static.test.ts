import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("readStaticPublicCurriculumRoutes", () => {
  it("matches the validated default projection", () => {
    expect(readStaticPublicCurriculumRoutes()).toEqual(
      Effect.runSync(listPublicCurriculumRoutes())
    );
  });
});
