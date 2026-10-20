import { describe, expect, it } from "@effect/vitest";
import { COLORS } from "@repo/design-system/lib/color";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import type { MathAppearance } from "@/lib/content/renderer/client/base/visual/scene";

describe("MathVisual palette", () => {
  it.each([
    ["answer", "#c026d3"],
    ["construction", "#0d9488"],
    ["highlight", "#d97706"],
    ["primary", "#ea580c"],
    ["reference", "#64748b"],
    ["secondary", "#7c3aed"],
    ["warning", "#db2777"],
  ] satisfies readonly (readonly [MathAppearance, string])[])(
    "maps %s to its stable semantic color",
    (appearance, color) => {
      expect(resolveMathAppearance(appearance)).toBe(color);
      expect([COLORS.RED, COLORS.GREEN, COLORS.BLUE]).not.toContain(
        resolveMathAppearance(appearance)
      );
    }
  );
});
