import { describe, expect, it } from "@effect/vitest";
import { leafLayerSpec } from "@repo/design-system/components/contents/biology/lamina/model";

describe("leaf lamina cross-section model", () => {
  it("maps photosynthetic layers to expected chloroplast densities", () => {
    expect(leafLayerSpec("palisade").density).toBe("high");
    expect(leafLayerSpec("spongy").density).toBe("moderate");
    expect(leafLayerSpec("stoma").density).toBe("guardOnly");
    expect(leafLayerSpec("cuticle").density).toBe("none");
    expect(leafLayerSpec("upperEpidermis").density).toBe("none");
    expect(leafLayerSpec("vascular").density).toBe("none");
    expect(leafLayerSpec("lowerEpidermis").density).toBe("none");
  });

  it("orders vertical focus heights from upper cuticle down to stoma", () => {
    expect(leafLayerSpec("cuticle").focusY).toBeGreaterThan(
      leafLayerSpec("upperEpidermis").focusY
    );
    expect(leafLayerSpec("upperEpidermis").focusY).toBeGreaterThan(
      leafLayerSpec("palisade").focusY
    );
    expect(leafLayerSpec("palisade").focusY).toBeGreaterThan(
      leafLayerSpec("spongy").focusY
    );
    expect(leafLayerSpec("spongy").focusY).toBeGreaterThan(
      leafLayerSpec("lowerEpidermis").focusY
    );
    expect(leafLayerSpec("lowerEpidermis").focusY).toBeGreaterThan(
      leafLayerSpec("stoma").focusY
    );
  });
});
