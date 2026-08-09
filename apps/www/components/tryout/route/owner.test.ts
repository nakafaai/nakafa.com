import { describe, expect, it } from "vitest";
import {
  selectTryoutBasePage,
  selectTryoutSetReturnHref,
} from "@/components/tryout/route/owner";

describe("try-out route ownership", () => {
  it("keeps current and redirecting attempts on the canonical public page", () => {
    expect(
      selectTryoutBasePage({
        attemptPage: { kind: "current" },
        publicPage: "public",
      })
    ).toBe("public");
    expect(
      selectTryoutBasePage({
        attemptPage: { kind: "redirect" },
        publicPage: "public",
      })
    ).toBe("public");
  });

  it("gives an exact retained capability its frozen page", () => {
    expect(
      selectTryoutBasePage({
        attemptPage: { kind: "retained", page: "frozen" },
        publicPage: "public",
      })
    ).toBe("frozen");
    expect(
      selectTryoutBasePage({ attemptPage: null, publicPage: "public" })
    ).toBe("public");
  });

  it("keeps renamed retained navigation on the frozen set path", () => {
    expect(
      selectTryoutSetReturnHref({
        attemptPage: {
          attemptId: "attempt-1",
          kind: "retained",
          page: {
            set: { publicPath: "try-out/indonesia/tka/2027/set-1" },
          },
        },
        publicHref: "/try-out/indonesia/tka/2027/renamed-set",
      })
    ).toBe("/try-out/indonesia/tka/2027/set-1?attemptId=attempt-1");
    expect(
      selectTryoutSetReturnHref({
        attemptPage: null,
        publicHref: "/try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("/try-out/indonesia/tka/2027/set-1");
  });
});
