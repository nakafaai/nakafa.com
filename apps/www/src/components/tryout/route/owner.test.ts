import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  createTryoutSetRestartTarget,
  selectTryoutSectionReturnPath,
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
      selectTryoutSetLinks(
        Option.some({ setPublicPath: "try-out/indonesia/tka/2027/renamed-set" })
      )
    ).toEqual({
      currentPath: "try-out/indonesia/tka/2027/renamed-set",
      returnPath: "try-out/indonesia/tka/2027",
    });
    expect(selectTryoutSetLinks(Option.none())).toEqual({
      currentPath: "try-out",
      returnPath: "try-out",
    });
    expect(
      selectTryoutSetLinks(Option.some({ setPublicPath: "malformed" }))
    ).toEqual({
      currentPath: "malformed",
      returnPath: "try-out",
    });
  });

  it("uses the active retained set destination or the try-out root", () => {
    expect(
      selectTryoutSectionReturnPath({
        attemptPage: Option.some({
          activeSetPublicPath: "try-out/indonesia/tka/2027/renamed-set",
          kind: "retained",
        }),
        publicPath: "try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("try-out/indonesia/tka/2027/renamed-set");
    expect(
      selectTryoutSectionReturnPath({
        attemptPage: Option.some({
          activeSetPublicPath: null,
          kind: "retained",
        }),
        publicPath: "try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("try-out");
    expect(
      selectTryoutSectionReturnPath({
        attemptPage: Option.none(),
        publicPath: "try-out/indonesia/tka/2027/set-1",
      })
    ).toBe("try-out/indonesia/tka/2027/set-1");
  });
});
