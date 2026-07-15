import { buttonVariants } from "@repo/design-system/lib/button";
import { describe, expect, it } from "vitest";

const BUTTON_VARIANTS = [
  "default",
  "default-outline",
  "destructive",
  "destructive-outline",
  "success-outline",
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

  it("keeps the success outline in the success family", () => {
    const classes = buttonVariants({ variant: "success-outline" }).split(" ");

    expect(classes).toContain("border-success");
    expect(classes).toContain(
      "bg-[color-mix(in_oklch,var(--success)_5%,var(--background))]"
    );
    expect(classes).toContain(
      "hover:bg-[color-mix(in_oklch,var(--success)_8%,var(--background))]"
    );
  });
});
