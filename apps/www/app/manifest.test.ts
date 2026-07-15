import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { describe, expect, it, vi } from "vitest";
import manifest from "@/app/manifest";

const HEX_COLOR_PATTERN = /#[\da-f]{3,8}\b/i;

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(() =>
    Promise.resolve((key: string) => {
      if (key === "description") {
        return "Nakafa description";
      }

      return key;
    })
  ),
}));

describe("manifest", () => {
  it("uses the canonical light compatibility color without hex literals", async () => {
    const value = await manifest();

    expect(value.theme_color).toBe(THEME_COMPATIBILITY_COLORS.light.background);
    expect(value.background_color).toBe(
      THEME_COMPATIBILITY_COLORS.light.background
    );
    expect(JSON.stringify(value)).not.toMatch(HEX_COLOR_PATTERN);
  });
});
