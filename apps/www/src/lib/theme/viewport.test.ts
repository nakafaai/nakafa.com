import { describe, expect, it } from "@effect/vitest";
import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { appViewport } from "@/lib/theme/viewport";

describe("appViewport", () => {
  it("uses the shared light and dark compatibility colors", () => {
    expect(appViewport.themeColor).toEqual([
      {
        media: "(prefers-color-scheme: light)",
        color: THEME_COMPATIBILITY_COLORS.light.background,
      },
      {
        media: "(prefers-color-scheme: dark)",
        color: THEME_COMPATIBILITY_COLORS.dark.background,
      },
    ]);
  });

  it("keeps the default interactive widget mode implicit", () => {
    expect(appViewport).not.toHaveProperty("interactiveWidget");
  });
});
