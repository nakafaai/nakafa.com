import { describe, expect, it } from "@effect/vitest";
import { themeOptions } from "@repo/design-system/lib/theme/options";
import { themes } from "@repo/design-system/lib/theme/registry";
import { Array as Arr } from "effect";

describe("theme picker options", () => {
  it("stays synchronized with every runtime theme definition", () => {
    expect(themeOptions).toHaveLength(themes.length);

    Arr.forEach(themeOptions, (option, index) => {
      const { icon, ...runtimeDefinition } = option;

      expect(icon).toBeDefined();
      expect(runtimeDefinition).toEqual(themes[index]);
    });
  });

  it("defines one icon for every selectable value", () => {
    expect(Arr.map(themeOptions, (option) => option.value)).toEqual(
      Arr.map(themes, (theme) => theme.value)
    );
    expect(
      Arr.dedupeWith(
        Arr.map(themeOptions, (option) => option.icon),
        (self, that) => self === that
      ).length
    ).toBe(themeOptions.length);
  });
});
