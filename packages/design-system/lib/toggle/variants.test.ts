import { toggleVariants } from "@repo/design-system/lib/toggle/variants";
import { describe, expect, it } from "vitest";

describe("toggleVariants", () => {
  it.each([
    "default",
    "outline",
  ] as const)("keeps %s keyboard focus subtle", (variant) => {
    const classes = toggleVariants({ variant }).split(" ");

    expect(classes).toContain("focus-visible:ring-1");
    expect(classes).toContain("focus-visible:ring-ring/40");
  });
});
