import { describe, expect, it } from "@effect/vitest";
import {
  createTryoutSetRestartTarget,
  selectTryoutFrozenPage,
  selectTryoutSectionReturnHref,
  selectTryoutSetPages,
  selectTryoutTrackReturnHref,
} from "@/components/tryout/route/owner";

describe("try-out route ownership", () => {
  it("keeps a current terminal attempt on its verified frozen page", () => {
    const frozenPage = { entrySection: "snapshot-section" };
    const activePage = { entrySection: "active-section" };

    expect(
      selectTryoutSetPages({
        attemptPage: {
          kind: "current",
          page: frozenPage,
          restartTarget: "verified-target",
        },
        publicPage: activePage,
        publicRestartTarget: "contradictory-public-target",
      })
    ).toEqual({ page: frozenPage, restartTarget: "verified-target" });
    expect(
      selectTryoutFrozenPage({
        kind: "current",
        page: frozenPage,
      })
    ).toBe(frozenPage);
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

  it("uses the active parent track or the try-out root", () => {
    expect(
      selectTryoutTrackReturnHref({
        setPublicPath: "try-out/indonesia/tka/2027/renamed-set",
      })
    ).toBe("/try-out/indonesia/tka/2027");
    expect(selectTryoutTrackReturnHref(null)).toBe("/try-out");
    expect(selectTryoutTrackReturnHref({ setPublicPath: "malformed" })).toBe(
      "/try-out"
    );
  });

  it("uses the active retained set destination or the try-out root", () => {
    expect(
      selectTryoutSectionReturnHref({
        attemptPage: {
          activeSetPublicPath: "try-out/indonesia/tka/2027/renamed-set",
          kind: "retained",
        },
        publicHref: "/try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("/try-out/indonesia/tka/2027/renamed-set");
    expect(
      selectTryoutSectionReturnHref({
        attemptPage: {
          activeSetPublicPath: null,
          kind: "retained",
        },
        publicHref: "/try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("/try-out");
    expect(
      selectTryoutSectionReturnHref({
        attemptPage: null,
        publicHref: "/try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("/try-out/indonesia/tka/2027/set-1");
  });
});
