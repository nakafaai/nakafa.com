import { describe, expect, it } from "@effect/vitest";
import { toggleVariants } from "@repo/design-system/lib/toggle/variants";

describe("toggleVariants", () => {
  it.each(["default", "outline"] as const)(
    "gives %s toggles the focus ring of buttons",
    (variant) => {
      const classes = toggleVariants({ variant }).split(" ");

      expect(classes).toContain("focus-visible:ring-3");
      expect(classes).toContain("focus-visible:ring-ring/50");
    }
  );
});
