// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readOgMetadata } from "@/app/og/content";

const mocks = vi.hoisted(() => ({
  getCachedMetadataFromSlug: vi.fn(),
  parseMaterialParams: vi.fn(),
  readMaterialMetadata: vi.fn(),
  toMaterialMetadataCopy: vi.fn(),
}));

vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data",
  () => ({ parseMaterialParams: mocks.parseMaterialParams })
);
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata",
  () => ({ toMaterialMetadataCopy: mocks.toMaterialMetadataCopy })
);
vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source",
  () => ({ readMaterialMetadata: mocks.readMaterialMetadata })
);
vi.mock("@/lib/utils/system", () => ({
  getCachedMetadataFromSlug: mocks.getCachedMetadataFromSlug,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.parseMaterialParams.mockImplementation(
    (locale: string, slug: readonly string[]) => {
      if (slug[0] !== "subjects" || slug.length < 4) {
        return null;
      }
      const [, subject, topic, ...lesson] = slug;
      return { lesson, locale, subject, topic };
    }
  );
});

describe("OG content metadata", () => {
  it("reads material metadata through the published material owner", async () => {
    const source = {
      metadata: {
        description: "Understand the concept of a function.",
        title: "Function Concept",
      },
      route: {
        description: "Fallback description",
        title: "Fallback title",
      },
    };
    const copy = {
      description: "Understand the concept of a function.",
      title: "Function Concept",
    };
    mocks.readMaterialMetadata.mockResolvedValue(source);
    mocks.toMaterialMetadataCopy.mockReturnValue(copy);

    await expect(
      readOgMetadata("en", [
        "subjects",
        "mathematics",
        "function-composition-inverse-function",
        "function-concept",
      ])
    ).resolves.toEqual(copy);
    expect(mocks.toMaterialMetadataCopy).toHaveBeenCalledWith(source);
    expect(mocks.getCachedMetadataFromSlug).not.toHaveBeenCalled();
  });

  it("keeps non-material metadata on the generic content owner", async () => {
    mocks.getCachedMetadataFromSlug.mockResolvedValue({
      description: "Nakafa description",
      title: "Nakafa",
    });

    await expect(readOgMetadata("en", ["about"])).resolves.toEqual({
      description: "Nakafa description",
      title: "Nakafa",
    });
    expect(mocks.readMaterialMetadata).not.toHaveBeenCalled();
    expect(mocks.toMaterialMetadataCopy).not.toHaveBeenCalled();
  });
});
