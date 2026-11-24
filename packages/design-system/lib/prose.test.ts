import { describe, expect, it } from "@effect/vitest";
import {
  blockGapVariants,
  contentGridVariants,
  contentStackVariants,
  mathBlockVariants,
  mathContainerVariants,
} from "@repo/design-system/lib/prose";

describe("prose vertical rhythm and math stacking", () => {
  it("keeps mathBlockVariants margin-free while blockGapVariants supplies outer my-4 rhythm", () => {
    expect(mathBlockVariants()).not.toContain("my-4");
    expect(blockGapVariants()).toBe("my-4 first:mt-0 last:mb-0");
  });

  it("fuses consecutive BlockMath rows inside mathContainerVariants without internal my-4 spacing", () => {
    const classes = mathContainerVariants();
    expect(classes).toContain("my-4");
    expect(classes).toContain("first:mt-0");
    expect(classes).toContain("last:mb-0");
    expect(classes).toContain("*:my-0");
    expect(classes).toContain("[&_[data-math-block]]:my-0");
    expect(classes).toContain("[&_[data-math-block]]:rounded-none");
    expect(classes).toContain("[&_[data-math-block]]:border-b-0");
    expect(classes).toContain("[&>:first-child[data-math-block]]:rounded-t-xl");
    expect(classes).toContain(
      "[&>:first-child_[data-math-block]]:rounded-t-xl"
    );
    expect(classes).toContain("[&>:last-child[data-math-block]]:rounded-b-xl");
    expect(classes).toContain("[&>:last-child[data-math-block]]:border-b");
    expect(classes).toContain("[&>:last-child_[data-math-block]]:rounded-b-xl");
    expect(classes).toContain("[&>:last-child_[data-math-block]]:border-b");
  });

  it("collapses child vertical margins inside contentStackVariants and contentGridVariants", () => {
    expect(contentStackVariants()).toContain("my-4");
    expect(contentStackVariants()).toContain("flex-col");
    expect(contentStackVariants()).toContain("gap-4");
    expect(contentStackVariants()).toContain("*:my-0");
    expect(contentGridVariants()).toContain("my-4");
    expect(contentGridVariants()).toContain("grid-cols-1");
    expect(contentGridVariants()).toContain("gap-4");
    expect(contentGridVariants()).toContain("*:my-0");
  });
});
