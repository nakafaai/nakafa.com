import { describe, expect, it } from "vitest";
import {
  selectTryoutFrozenPage,
  selectTryoutSetPages,
  selectTryoutSetReturnHref,
} from "@/components/tryout/route/owner";

describe("try-out route ownership", () => {
  it("keeps a current terminal attempt on its verified frozen page", () => {
    const frozenPage = { entrySection: "snapshot-section" };
    const activePage = { entrySection: "active-section" };

    expect(
      selectTryoutSetPages({
        attemptPage: { kind: "current", page: frozenPage },
        publicPage: activePage,
      })
    ).toEqual({ page: frozenPage, startPage: activePage });
    expect(selectTryoutFrozenPage({ kind: "current", page: frozenPage })).toBe(
      frozenPage
    );
  });

  it("keeps redirecting attempts on the canonical public page", () => {
    expect(
      selectTryoutSetPages({
        attemptPage: { kind: "redirect" },
        publicPage: "public",
      })
    ).toEqual({ page: "public", startPage: "public" });
    expect(selectTryoutFrozenPage({ kind: "redirect" })).toBeNull();
  });

  it("keeps an exact retained capability entirely on its frozen page", () => {
    expect(
      selectTryoutSetPages({
        attemptPage: { kind: "retained", page: "frozen" },
        publicPage: null,
      })
    ).toEqual({ page: "frozen", startPage: "frozen" });
    expect(
      selectTryoutSetPages({ attemptPage: null, publicPage: "public" })
    ).toEqual({ page: "public", startPage: "public" });
    expect(
      selectTryoutSetPages({ attemptPage: null, publicPage: null })
    ).toBeNull();
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
