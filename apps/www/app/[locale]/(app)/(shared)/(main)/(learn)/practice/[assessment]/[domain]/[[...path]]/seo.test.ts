// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readPracticeRouteSeoContext } from "./seo";

describe("practice route SEO support", () => {
  it("requires question metadata to resolve through its parent set route", () => {
    expect(() =>
      readPracticeRouteSeoContext(
        {
          kind: "exercise-question",
          locale: "en",
          parentPath:
            "practice/snbt/quantitative-knowledge/tryout-2026/missing-set",
          sourcePath:
            "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/9",
        },
        []
      )
    ).toThrow();
  });
});
