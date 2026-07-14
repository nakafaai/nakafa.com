import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme-compatibility";
import { describe, expect, it } from "vitest";
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
});
