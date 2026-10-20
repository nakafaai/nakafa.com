// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readNamespaceSegment } from "@repo/contents/route/surface";
import { Effect, Option } from "effect";
import { readOgCopy } from "@/lib/og/copy.server";

const getPublishedArticleCategoryMock = vi.hoisted(() => vi.fn());
const getArticleModelMock = vi.hoisted(() => vi.fn());
const getMaterialModelMock = vi.hoisted(() => vi.fn());
const getCachedMetadataFromSlugMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/category", () => ({
  /** Controls which article category is published. */
  getPublishedArticleCategory: getPublishedArticleCategoryMock,
}));

vi.mock("@/lib/content/article/publication", () => ({
  /** Controls the published article model. */
  getArticleModel: getArticleModelMock,
}));

vi.mock("@/lib/content/material/publication", () => ({
  /** Controls the published material model. */
  getMaterialModel: getMaterialModelMock,
}));

vi.mock("@/lib/og/metadata", () => ({
  /** Answers the default copy of a route. */
  getCachedMetadataFromSlug: getCachedMetadataFromSlugMock,
}));

vi.mock("@repo/internationalization/src/translator", () => ({
  /** Names each copy key by its namespace. */
  readServerTranslator:
    async ({ namespace }: { readonly namespace: string }) =>
    (key: string) =>
      `${namespace}.${key}`,
}));

const CATEGORY = "belajar";
const ARTICLE = "aljabar-dasar";
const SUBJECT = readNamespaceSegment("subject", "en") ?? "subjects";
const projection = (title: string, description?: string) => ({
  model: { projection: { metadata: { description, title } } },
});

beforeEach(() => {
  getPublishedArticleCategoryMock
    .mockReset()
    .mockResolvedValue(Option.some({ title: "Belajar" }));
  getArticleModelMock
    .mockReset()
    .mockResolvedValue(projection("Aljabar", "Dasar"));
  getMaterialModelMock.mockReset().mockResolvedValue(projection("Integral"));
  getCachedMetadataFromSlugMock
    .mockReset()
    .mockResolvedValue({ description: undefined, title: "Default" });
});

describe("og copy of articles", () => {
  it("names the articles index with the common and article copy", async () => {
    const copy = await Effect.runPromise(readOgCopy("en", ["articles"]));

    expect(copy).toEqual(
      Option.some({
        description: "Articles.description",
        title: "Common.articles",
      })
    );
  });

  it("names one published category with its title", async () => {
    const copy = await Effect.runPromise(
      readOgCopy("en", ["articles", CATEGORY])
    );

    expect(Option.getOrThrow(copy)).toEqual({
      description: "Articles.description",
      title: "Belajar",
    });
  });

  it("answers none for an unpublished category", async () => {
    getPublishedArticleCategoryMock.mockResolvedValue(Option.none());

    const copy = await Effect.runPromise(
      readOgCopy("en", ["articles", CATEGORY])
    );

    expect(Option.isNone(copy)).toBe(true);
  });

  it("names one published article with its description, or its title", async () => {
    const withDescription = await Effect.runPromise(
      readOgCopy("en", ["articles", CATEGORY, ARTICLE])
    );
    getArticleModelMock.mockResolvedValue(projection("Aljabar"));
    const titleOnly = await Effect.runPromise(
      readOgCopy("en", ["articles", CATEGORY, ARTICLE])
    );

    expect(Option.getOrThrow(withDescription)).toEqual({
      description: "Dasar",
      title: "Aljabar",
    });
    expect(Option.getOrThrow(titleOnly)).toEqual({
      description: "Aljabar",
      title: "Aljabar",
    });
  });

  it("answers none for a missing article or a malformed path", async () => {
    getArticleModelMock.mockResolvedValue(null);
    const missing = await Effect.runPromise(
      readOgCopy("en", ["articles", CATEGORY, ARTICLE])
    );
    const deeper = await Effect.runPromise(
      readOgCopy("en", ["articles", CATEGORY, ARTICLE, "extra"])
    );
    const badCategory = await Effect.runPromise(
      readOgCopy("en", ["articles", "BAD CATEGORY!", ARTICLE])
    );
    const badArticle = await Effect.runPromise(
      readOgCopy("en", ["articles", CATEGORY, "BAD ARTICLE!"])
    );
    const badIndexCategory = await Effect.runPromise(
      readOgCopy("en", ["articles", "BAD CATEGORY!"])
    );

    for (const copy of [
      missing,
      deeper,
      badCategory,
      badArticle,
      badIndexCategory,
    ]) {
      expect(Option.isNone(copy)).toBe(true);
    }
  });
});

describe("og copy of materials", () => {
  it("names one published lesson with its search title", async () => {
    const copy = await Effect.runPromise(
      readOgCopy("en", [SUBJECT, "math", "calculus", "integral"])
    );

    expect(Option.getOrThrow(copy)).toEqual({
      description: "Integral",
      title: "Integral",
    });
    expect(getMaterialModelMock).toHaveBeenCalledWith(
      "en",
      `${SUBJECT}/math/calculus/integral`
    );
  });

  it("answers none for an unpublished lesson", async () => {
    getMaterialModelMock.mockResolvedValue(null);

    const copy = await Effect.runPromise(
      readOgCopy("en", [SUBJECT, "math", "calculus", "integral"])
    );

    expect(Option.isNone(copy)).toBe(true);
  });

  it("answers the default copy for a material path without a lesson", async () => {
    const copy = await Effect.runPromise(readOgCopy("en", [SUBJECT, "math"]));

    expect(Option.getOrThrow(copy)).toEqual({
      description: "Default",
      title: "Default",
    });
    expect(getMaterialModelMock).not.toHaveBeenCalled();
  });
});

describe("og copy of other routes", () => {
  it("answers the default copy of the site's own routes", async () => {
    getCachedMetadataFromSlugMock.mockResolvedValue({
      description: "Quran",
      title: "Al-Quran",
    });

    const copy = await Effect.runPromise(readOgCopy("id", ["quran", "1"]));

    expect(Option.getOrThrow(copy)).toEqual({
      description: "Quran",
      title: "Al-Quran",
    });
    expect(getCachedMetadataFromSlugMock).toHaveBeenCalledWith("id", [
      "quran",
      "1",
    ]);
  });
});
