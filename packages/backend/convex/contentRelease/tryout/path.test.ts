import { toTryoutCorpusPath } from "@repo/backend/convex/contentRelease/tryout/path";
import { describe, expect, it } from "vitest";

describe("contentRelease/tryout/path", () => {
  it("normalizes retained paths without duplicating the corpus root", () => {
    expect(toTryoutCorpusPath("question-bank/tryout/id/set-1")).toBe(
      "packages/corpus/question-bank/tryout/id/set-1"
    );
    expect(
      toTryoutCorpusPath("packages/corpus/question-bank/tryout/id/set-1")
    ).toBe("packages/corpus/question-bank/tryout/id/set-1");
  });
});
