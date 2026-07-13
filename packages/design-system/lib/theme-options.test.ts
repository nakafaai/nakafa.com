import { themes } from "@repo/design-system/lib/theme";
import { themeOptions } from "@repo/design-system/lib/theme-options";
import { describe, expect, it } from "vitest";

describe("theme picker options", () => {
  it("stays synchronized with every runtime theme definition", () => {
    expect(themeOptions).toHaveLength(themes.length);

    for (const [index, option] of themeOptions.entries()) {
      const { icon, ...runtimeDefinition } = option;

      expect(icon).toBeDefined();
      expect(runtimeDefinition).toEqual(themes[index]);
    }
  });

  it("defines one icon for every selectable value", () => {
    expect(themeOptions.map((option) => option.value)).toEqual(
      themes.map((theme) => theme.value)
    );
    expect(new Set(themeOptions.map((option) => option.icon)).size).toBe(
      themeOptions.length
    );
  });
});
