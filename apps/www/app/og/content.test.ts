// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readOgMetadata } from "@/app/og/content";

const mocks = vi.hoisted(() => ({
  getCachedMetadataFromSlug: vi.fn(),
  notFound: vi.fn(),
  parseMaterialParams: vi.fn(),
  readArticleOgMetadata: vi.fn(),
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
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content",
  () => ({ readMaterialMetadata: mocks.readMaterialMetadata })
);
vi.mock("@/app/og/article", () => ({
  readArticleOgMetadata: mocks.readArticleOgMetadata,
}));
vi.mock("@/lib/utils/system", () => ({
  getCachedMetadataFromSlug: mocks.getCachedMetadataFromSlug,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error("OG article not found");
  });
  mocks.readArticleOgMetadata.mockResolvedValue(null);
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
  it("reads article metadata through signed or preview ownership", async () => {
    const copy = {
      description: "Signed article description",
      title: "Signed article",
    };
    mocks.readArticleOgMetadata.mockResolvedValueOnce(copy);

    await expect(
      readOgMetadata("en", ["articles", "politics", "signed-article"])
    ).resolves.toEqual(copy);
    expect(mocks.readArticleOgMetadata).toHaveBeenCalledWith("en", [
      "articles",
      "politics",
      "signed-article",
    ]);
    expect(mocks.getCachedMetadataFromSlug).not.toHaveBeenCalled();
  });

  it("rejects an article path absent from signed or preview ownership", async () => {
    await expect(
      readOgMetadata("en", ["articles", "politics", "missing"])
    ).rejects.toThrow("OG article not found");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    expect(mocks.getCachedMetadataFromSlug).not.toHaveBeenCalled();
  });

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
