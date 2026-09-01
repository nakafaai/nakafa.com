import { describe, expect, it } from "@effect/vitest";
import {
  projectTryoutResponseSpec,
  type TryoutResponseSpec,
} from "@repo/backend/convex/tryouts/response/model";

describe("try-out response projection", () => {
  it("hides and reveals choice answer keys without changing content", () => {
    const responseSpec = {
      kind: "single-choice",
      options: [
        {
          isCorrect: true,
          label: "Answer",
          optionKey: "option-1",
          order: 1,
        },
      ],
    } satisfies TryoutResponseSpec;

    expect(projectTryoutResponseSpec(responseSpec, false)).toEqual({
      kind: "single-choice",
      options: [
        {
          label: "Answer",
          optionKey: "option-1",
          order: 1,
        },
      ],
    });
    expect(projectTryoutResponseSpec(responseSpec, true)).toEqual(responseSpec);
  });

  it("hides and reveals category answer keys without changing labels", () => {
    const responseSpec = {
      categories: [
        {
          categoryKey: "category-1",
          label: "Yes",
          order: 1,
        },
      ],
      kind: "category",
      statements: [
        {
          correctCategoryKey: "category-1",
          label: "Statement",
          order: 1,
          statementKey: "statement-1",
        },
      ],
    } satisfies TryoutResponseSpec;

    expect(projectTryoutResponseSpec(responseSpec, false)).toEqual({
      categories: responseSpec.categories,
      kind: "category",
      statements: [
        {
          label: "Statement",
          order: 1,
          statementKey: "statement-1",
        },
      ],
    });
    expect(projectTryoutResponseSpec(responseSpec, true)).toEqual(responseSpec);
  });
});
