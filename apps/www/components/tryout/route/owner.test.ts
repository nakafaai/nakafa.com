import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
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
    ).toEqual(
      Option.some({
        entrySection: { sectionKey: "section-1" },
        setPublicPath: "try-out/indonesia/tka/2027/set-1",
      })
    );
    expect(
      createTryoutSetRestartTarget({
        entrySection: null,
        set: { publicPath: "try-out/indonesia/tka/2027/set-1" },
      })
    ).toEqual(Option.none());
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
        attemptPage: Option.some({
          activeSetPublicPath: "try-out/indonesia/tka/2027/renamed-set",
          kind: "retained",
        }),
        publicHref: "/try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("/try-out/indonesia/tka/2027/renamed-set");
    expect(
      selectTryoutSectionReturnHref({
        attemptPage: Option.some({
          activeSetPublicPath: null,
          kind: "retained",
        }),
        publicHref: "/try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("/try-out");
    expect(
      selectTryoutSectionReturnHref({
        attemptPage: Option.none(),
        publicHref: "/try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("/try-out/indonesia/tka/2027/set-1");
  });
});
