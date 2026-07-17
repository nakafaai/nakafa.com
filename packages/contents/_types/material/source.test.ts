import { MATERIAL_CARD_DESCRIPTION_MAX_LENGTH } from "@repo/contents/_types/material/description";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import { locales } from "@repo/utilities/locales";
import { describe, expect, it } from "vitest";

describe("material source registry", () => {
  it("keeps material keys and asset roots unique", () => {
    const keys = new Set(MATERIAL_SOURCES.map((material) => material.key));
    const assetRoots = new Set(
      MATERIAL_SOURCES.map((material) => material.assetRoot)
    );

    expect(keys.size).toBe(MATERIAL_SOURCES.length);
    expect(assetRoots.size).toBe(MATERIAL_SOURCES.length);
  });

  it("keeps every localized card description concise", () => {
    for (const material of MATERIAL_SOURCES) {
      for (const locale of locales) {
        const description = material.translations[locale].description;

        expect(description.trim()).toBe(description);
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThanOrEqual(
          MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
        );
      }
    }
  });
});
