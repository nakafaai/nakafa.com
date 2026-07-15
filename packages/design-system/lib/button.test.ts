import { buttonVariants } from "@repo/design-system/lib/button";
import { describe, expect, it } from "vitest";

const BUTTON_VARIANTS = [
  "default",
  "default-outline",
  "destructive",
  "destructive-outline",
  "outline",
  "secondary",
  "secondary-outline",
  "ghost",
  "link",
] as const;

describe("buttonVariants", () => {
  it.each(BUTTON_VARIANTS)("keeps %s keyboard focus subtle", (variant) => {
    const classes = buttonVariants({ variant }).split(" ");

    expect(classes).toContain("focus-visible:ring-[3px]");
    expect(classes).toContain("focus-visible:ring-ring/50");
  });

  it("keeps destructive focus in the destructive family", () => {
    const classes = buttonVariants({ variant: "destructive" }).split(" ");

    expect(classes).toContain("focus-visible:ring-destructive/20");
  });
});
