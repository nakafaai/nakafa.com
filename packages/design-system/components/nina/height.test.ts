import { describe, expect, it } from "@effect/vitest";
import { wholeHeight } from "@repo/design-system/components/nina/height";
import { pictureHeight } from "@repo/design-system/lib/picture";
import { scene } from "@repo/mascot/nina/figure";

describe("wholeHeight", () => {
  it("is 182 pixels at the 176 pixels of a full-page state", () => {
    expect(wholeHeight(176)).toBe(182);
  });

  it("is the height that the picture of her whole figure takes", () => {
    const { box } = scene({ whole: true });

    expect(wholeHeight(176)).toBe(pictureHeight(176, box));
    expect(wholeHeight(96)).toBe(pictureHeight(96, box));
  });
});
