import { describe, expect, it } from "@effect/vitest";
import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { Schema } from "effect";
import manifest from "@/app/manifest";

const HEX_COLOR_PATTERN = /#[\da-f]{3,8}\b/i;
const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

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
    expect(encodeJson(value)).not.toMatch(HEX_COLOR_PATTERN);
  });
});
