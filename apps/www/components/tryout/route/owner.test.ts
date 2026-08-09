import { describe, expect, it } from "vitest";
import {
  createTryoutSetRestartTarget,
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
        publicRestartTarget: "active-target",
      })
    ).toEqual({ page: frozenPage, restartTarget: "active-target" });
    expect(selectTryoutFrozenPage({ kind: "current", page: frozenPage })).toBe(
      frozenPage
    );
  });

  it("keeps redirecting attempts on the canonical public page", () => {
    expect(
      selectTryoutSetPages({
        attemptPage: { kind: "redirect" },
        publicPage: "public",
        publicRestartTarget: "public-target",
      })
    ).toEqual({ page: "public", restartTarget: "public-target" });
    expect(selectTryoutFrozenPage({ kind: "redirect" })).toBeNull();
  });

  it("keeps retained display frozen and uses only its verified restart target", () => {
    expect(
      selectTryoutSetPages({
        attemptPage: {
          kind: "retained",
          page: "frozen",
          restartTarget: "current-target",
        },
        publicPage: null,
        publicRestartTarget: null,
      })
    ).toEqual({ page: "frozen", restartTarget: "current-target" });
    expect(
      selectTryoutSetPages({
        attemptPage: {
          kind: "retained",
          page: "frozen",
          restartTarget: null,
        },
        publicPage: null,
        publicRestartTarget: "untrusted-fallback",
      })
    ).toEqual({ page: "frozen", restartTarget: null });
    expect(
      selectTryoutSetPages({
        attemptPage: null,
        publicPage: "public",
        publicRestartTarget: "public-target",
      })
    ).toEqual({ page: "public", restartTarget: "public-target" });
    expect(
      selectTryoutSetPages({
        attemptPage: null,
        publicPage: null,
        publicRestartTarget: null,
      })
    ).toBeNull();
  });

  it("derives a restart target only when the current set has an entry", () => {
    expect(
      createTryoutSetRestartTarget({
        entrySection: { sectionKey: "section-1" },
        set: { publicPath: "try-out/indonesia/tka/2027/set-1" },
      })
    ).toEqual({
      entrySection: { sectionKey: "section-1" },
      setPublicPath: "try-out/indonesia/tka/2027/set-1",
    });
    expect(
      createTryoutSetRestartTarget({
        entrySection: null,
        set: { publicPath: "try-out/indonesia/tka/2027/set-1" },
      })
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
