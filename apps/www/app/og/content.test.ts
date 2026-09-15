// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readOgMetadata } from "@/app/og/content";

const mocks = vi.hoisted(() => ({
  getCachedMetadataFromSlug: vi.fn(),
  getMaterialModel: vi.fn(),
  parseMaterialParams: vi.fn(),
  readArticleOgMetadata: vi.fn(),
  readNakafaRuntimeQuery: vi.fn(),
  resolveMaterialOwner: vi.fn(),
  resolveReferenceInput: vi.fn(),
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
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/owner",
  () => ({ resolveMaterialOwner: mocks.resolveMaterialOwner })
);
vi.mock("@/app/og/article", () => ({
  readArticleOgMetadata: mocks.readArticleOgMetadata,
}));
vi.mock("@/lib/content/material/publication", () => ({
  getMaterialModel: mocks.getMaterialModel,
}));
vi.mock("@/lib/utils/system", () => ({
  getCachedMetadataFromSlug: mocks.getCachedMetadataFromSlug,
}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: mocks.readNakafaRuntimeQuery,
}));
vi.mock("@repo/backend/convex/contentRelease/reference/input", () => ({
  resolveReferenceInput: mocks.resolveReferenceInput,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readArticleOgMetadata.mockResolvedValue(null);
  mocks.resolveReferenceInput.mockReturnValue(Effect.succeed(null));
  mocks.readNakafaRuntimeQuery.mockReturnValue(Effect.succeed(null));
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

  it("returns null for an article path absent from signed or preview ownership", async () => {
    await expect(
      readOgMetadata("en", ["articles", "politics", "missing"])
    ).resolves.toBeNull();
    expect(mocks.getCachedMetadataFromSlug).not.toHaveBeenCalled();
    expect(mocks.getMaterialModel).not.toHaveBeenCalled();
  });

  it("reads material metadata through the published material owner", async () => {
    const metadata = {
      description: "Understand the concept of a function.",
      title: "Function Concept",
    };
    const copy = { ...metadata };
    mocks.resolveMaterialOwner.mockResolvedValueOnce({
      kind: "published",
      locale: "en",
      publicPath: "subjects/mathematics/function",
    });
    mocks.getMaterialModel.mockResolvedValueOnce({
      model: { projection: { metadata } },
    });
    mocks.toMaterialMetadataCopy.mockReturnValueOnce(copy);

    await expect(
      readOgMetadata("en", [
        "subjects",
        "mathematics",
        "function-composition-inverse-function",
        "function-concept",
      ])
    ).resolves.toEqual(copy);
    expect(mocks.getMaterialModel).toHaveBeenCalledWith(
      "en",
      "subjects/mathematics/function"
    );
    expect(mocks.toMaterialMetadataCopy).toHaveBeenCalledWith({ metadata });
    expect(mocks.getCachedMetadataFromSlug).not.toHaveBeenCalled();
  });

  it("reads preview material metadata without touching the published model", async () => {
    const metadata = {
      description: "Preview description",
      title: "Preview title",
    };
    const copy = { ...metadata };
    mocks.resolveMaterialOwner.mockResolvedValueOnce({
      appLocale: "en",
      kind: "preview",
      preview: { metadata },
    });
    mocks.toMaterialMetadataCopy.mockReturnValueOnce(copy);

    await expect(
      readOgMetadata("en", [
        "subjects",
        "mathematics",
        "function-composition-inverse-function",
        "function-concept",
      ])
    ).resolves.toEqual(copy);
    expect(mocks.getMaterialModel).not.toHaveBeenCalled();
  });

  it("returns null when no material owner resolves", async () => {
    mocks.resolveMaterialOwner.mockResolvedValueOnce(null);

    await expect(
      readOgMetadata("en", [
        "subjects",
        "mathematics",
        "function-composition-inverse-function",
        "function-concept",
      ])
    ).resolves.toBeNull();
    expect(mocks.getMaterialModel).not.toHaveBeenCalled();
    expect(mocks.toMaterialMetadataCopy).not.toHaveBeenCalled();
  });

  it("returns null when the material release is withdrawn", async () => {
    mocks.resolveMaterialOwner.mockResolvedValueOnce({
      kind: "published",
      locale: "en",
      publicPath: "subjects/mathematics/function",
    });
    mocks.getMaterialModel.mockResolvedValueOnce(null);

    await expect(
      readOgMetadata("en", [
        "subjects",
        "mathematics",
        "function-composition-inverse-function",
        "function-concept",
      ])
    ).resolves.toBeNull();
    expect(mocks.toMaterialMetadataCopy).not.toHaveBeenCalled();
  });

  it("derives a missing generic description from its title", async () => {
    mocks.getCachedMetadataFromSlug.mockResolvedValue({ title: "Nakafa" });

    await expect(readOgMetadata("en", ["about"])).resolves.toEqual({
      description: "Nakafa",
      title: "Nakafa",
    });
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
    expect(mocks.resolveMaterialOwner).not.toHaveBeenCalled();
    expect(mocks.toMaterialMetadataCopy).not.toHaveBeenCalled();
    expect(mocks.readNakafaRuntimeQuery).not.toHaveBeenCalled();
  });

  it("reads cached copy for content-owned slugs with a reference", async () => {
    const copy = { description: "Surah description", title: "Surah 1" };
    mocks.resolveReferenceInput.mockReturnValueOnce(Effect.succeed({ family: "quran" }));
    mocks.readNakafaRuntimeQuery.mockReturnValueOnce(Effect.succeed({ title: "Surah 1" }));
    mocks.getCachedMetadataFromSlug.mockResolvedValueOnce(copy);

    await expect(readOgMetadata("en", ["quran", "1"])).resolves.toEqual(copy);
    expect(mocks.getCachedMetadataFromSlug).toHaveBeenCalledWith("en", [
      "quran",
      "1",
    ]);
  });

  it("returns null for content-owned slugs with no reference", async () => {
    mocks.resolveReferenceInput.mockReturnValueOnce(Effect.succeed({ family: "quran" }));
    mocks.readNakafaRuntimeQuery.mockReturnValueOnce(Effect.succeed(null));

    await expect(readOgMetadata("id", ["quran", "999"])).resolves.toBeNull();
    expect(mocks.getCachedMetadataFromSlug).not.toHaveBeenCalled();
  });
});
