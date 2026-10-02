import { describe, expect, it } from "@effect/vitest";
import {
  createTryoutSetRestartTarget,
  selectTryoutSectionReturnHref,
  selectTryoutSetLinks,
} from "@/components/tryout/route/owner";

describe("try-out route ownership", () => {
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

  it("links the active set and its parent track or the try-out root", () => {
    expect(
      selectTryoutSetLinks({
        setPublicPath: "try-out/indonesia/tka/2027/renamed-set",
      })
    ).toEqual({
      currentHref: "/try-out/indonesia/tka/2027/renamed-set",
      returnHref: "/try-out/indonesia/tka/2027",
    });
    expect(selectTryoutSetLinks(null)).toEqual({
      currentHref: "/try-out",
      returnHref: "/try-out",
    });
    expect(selectTryoutSetLinks({ setPublicPath: "malformed" })).toEqual({
      currentHref: "/malformed",
      returnHref: "/try-out",
    });
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
