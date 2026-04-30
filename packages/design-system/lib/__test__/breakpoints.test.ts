import {
  createMaxWidthInclusiveMediaQuery,
  createMaxWidthMediaQuery,
  createMinWidthMediaQuery,
  TAILWIND_BREAKPOINTS,
  TAILWIND_MEDIA_QUERIES,
} from "@repo/design-system/lib/breakpoints";
import { describe, expect, it } from "vitest";

describe("breakpoint media queries", () => {
  it("matches Tailwind max breakpoint semantics", () => {
    expect(createMaxWidthMediaQuery(TAILWIND_BREAKPOINTS.xl)).toBe(
      "(width < 80rem)"
    );
    expect(TAILWIND_MEDIA_QUERIES.belowXl).toBe("(width < 80rem)");
  });

  it("supports inclusive runtime cutoffs", () => {
    expect(createMaxWidthInclusiveMediaQuery(1280)).toBe("(width <= 1280px)");
  });

  it("matches Tailwind min breakpoint semantics", () => {
    expect(createMinWidthMediaQuery(TAILWIND_BREAKPOINTS.lg)).toBe(
      "(width >= 64rem)"
    );
    expect(TAILWIND_MEDIA_QUERIES.lgAndUp).toBe("(width >= 64rem)");
  });
});
