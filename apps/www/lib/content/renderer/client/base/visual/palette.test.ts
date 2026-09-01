import { describe, expect, it } from "@effect/vitest";
import { resolveMathAppearance } from "@/lib/content/renderer/client/base/visual/palette";
import type { MathAppearance } from "@/lib/content/renderer/client/base/visual/scene";

describe("MathVisual palette", () => {
  it.each([
    ["answer", "#16a34a"],
    ["construction", "#0d9488"],
    ["highlight", "#d97706"],
    ["primary", "#2563eb"],
    ["reference", "#64748b"],
    ["secondary", "#7c3aed"],
    ["warning", "#dc2626"],
  ] satisfies readonly (readonly [MathAppearance, string])[])(
    "maps %s to its stable semantic color",
    (appearance, color) => {
      expect(resolveMathAppearance(appearance)).toBe(color);
    }
  );
});
