// @vitest-environment node
import {
  createMaxWidthInclusiveMediaQuery,
  createMaxWidthMediaQuery,
  TAILWIND_MEDIA_QUERIES,
} from "@repo/design-system/lib/breakpoints";
import { describe, expect, it } from "vitest";

describe("breakpoint media queries", () => {
  it("matches Tailwind max breakpoint semantics", () => {
    expect(createMaxWidthMediaQuery("80rem")).toBe("(width < 80rem)");
  });

  it("supports inclusive runtime cutoffs", () => {
    expect(createMaxWidthInclusiveMediaQuery(1280)).toBe("(width <= 1280px)");
  });

  it("exposes the media queries used by responsive components", () => {
    expect(TAILWIND_MEDIA_QUERIES).toEqual({
      belowSm: "(width < 40rem)",
      smAndUp: "(width >= 40rem)",
      belowMd: "(width < 48rem)",
      mdAndUp: "(width >= 48rem)",
      belowLg: "(width < 64rem)",
      lgAndUp: "(width >= 64rem)",
      belowXl: "(width < 80rem)",
      xlAndUp: "(width >= 80rem)",
      below2Xl: "(width < 96rem)",
      "2xlAndUp": "(width >= 96rem)",
    });
  });
});
