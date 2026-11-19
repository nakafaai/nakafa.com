// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { categoryLayout } from "@repo/design-system/components/contents/mathematics/chart/axis";

describe("category axis layout", () => {
  it("wraps labels whose longest word fits its band", () => {
    expect(
      categoryLayout({ band: 85, labels: ["Mother cell", "Endosperm"] })
    ).toBe("wrap");
  });

  it("slants every label when one word is wider than its band", () => {
    expect(
      categoryLayout({ band: 31, labels: ["Spore", "Endosperm nucleus"] })
    ).toBe("slant");
  });

  it("wraps an axis without labels", () => {
    expect(categoryLayout({ band: 10, labels: [] })).toBe("wrap");
  });
});
