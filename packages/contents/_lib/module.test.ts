import {
  getLocalizedContentPath,
  importContentModule,
} from "@repo/contents/_lib/module";
import { describe, expect, it } from "vitest";

describe("importContentModule", () => {
  it("builds localized paths for folder and file-stem MDX assets", () => {
    expect(getLocalizedContentPath("material/lesson/algebra", "en")).toBe(
      "material/lesson/algebra/en.mdx"
    );
    expect(
      getLocalizedContentPath(
        "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question",
        "id"
      )
    ).toBe(
      "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1/question.id.mdx"
    );
  });

  it("returns the dynamic import promise for localized content modules", async () => {
    await expect(importContentModule("missing/module", "en")).rejects.toThrow();
    await expect(
      importContentModule("missing/question-1/question", "id")
    ).rejects.toThrow();
  });
});
