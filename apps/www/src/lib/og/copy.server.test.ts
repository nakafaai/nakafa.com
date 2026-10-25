// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readNamespaceSegment } from "@repo/contents/route/surface";
import { Effect, Option } from "effect";
import { readOgCopy } from "@/lib/og/copy.server";

const getPublishedArticleCategoryMock = vi.hoisted(() => vi.fn());
const getArticleModelMock = vi.hoisted(() => vi.fn());
const getMaterialModelMock = vi.hoisted(() => vi.fn());
const getCachedMetadataFromSlugMock = vi.hoisted(() => vi.fn());
const queryContentStoreMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/article/category", () => ({
  /** Controls which article category is published. */
  readPublishedArticleCategory: getPublishedArticleCategoryMock,
}));

vi.mock("@/lib/content/article/publication", () => ({
  /** Controls the published article model. */
  getArticleModel: getArticleModelMock,
}));

vi.mock("@/lib/content/material/model", () => ({
  /** Controls the published material model. */
  getMaterialModel: getMaterialModelMock,
}));

vi.mock("@/lib/og/metadata", () => ({
  /** Answers the default copy of a route. */
  getMetadataFromSlug: getCachedMetadataFromSlugMock,
}));

vi.mock("@/lib/content/store/query", () => ({
  /** Controls whether the release lists one route. */
  queryContentStore: queryContentStoreMock,
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
    .mockReturnValue(Effect.succeedSome({ title: "Belajar" }));
  getArticleModelMock
    .mockReset()
    .mockReturnValue(Effect.succeedSome(projection("Aljabar", "Dasar")));
  getMaterialModelMock
    .mockReset()
    .mockReturnValue(Effect.succeedSome(projection("Integral")));
  getCachedMetadataFromSlugMock
    .mockReset()
    .mockReturnValue(
      Effect.succeed({ description: undefined, title: "Default" })
    );
  queryContentStoreMock
    .mockReset()
    .mockReturnValue(Effect.succeed({ title: "Listed" }));
});

describe("og copy of articles", () => {
  it.effect("names the curricula section with its index copy", () =>
    Effect.gen(function* () {
      const copy = yield* readOgCopy("id", ["curriculum"]);

      expect(copy).toStrictEqual(
        Option.some({
          description: "LearningPrograms.curriculum-index-metadata-description",
          title: "LearningPrograms.curriculum-index-metadata-title",
        })
      );
      expect(getCachedMetadataFromSlugMock).not.toHaveBeenCalled();
    })
  );

  it.effect("names the articles index with the common and article copy", () =>
    Effect.gen(function* () {
      const copy = yield* readOgCopy("en", ["articles"]);

      expect(copy).toEqual(
        Option.some({
          description: "Articles.description",
          title: "Common.articles",
        })
      );
    })
  );

  it.effect("names one published category with its title", () =>
    Effect.gen(function* () {
      const copy = yield* readOgCopy("en", ["articles", CATEGORY]);

      expect(Option.getOrThrow(copy)).toEqual({
        description: "Articles.description",
        title: "Belajar",
      });
    })
  );

  it.effect("answers none for an unpublished category", () =>
    Effect.gen(function* () {
      getPublishedArticleCategoryMock.mockReturnValue(Effect.succeedNone);

      const copy = yield* readOgCopy("en", ["articles", CATEGORY]);

      expect(Option.isNone(copy)).toBe(true);
    })
  );

  it.effect(
    "names one published article with its description, or its title",
    () =>
      Effect.gen(function* () {
        const withDescription = yield* readOgCopy("en", [
          "articles",
          CATEGORY,
          ARTICLE,
        ]);
        getArticleModelMock.mockReturnValue(
          Effect.succeedSome(projection("Aljabar"))
        );
        const titleOnly = yield* readOgCopy("en", [
          "articles",
          CATEGORY,
          ARTICLE,
        ]);

        expect(Option.getOrThrow(withDescription)).toEqual({
          description: "Dasar",
          title: "Aljabar",
        });
        expect(Option.getOrThrow(titleOnly)).toEqual({
          description: "Aljabar",
          title: "Aljabar",
        });
      })
  );

  it.effect("answers none for a missing article or a malformed path", () =>
    Effect.gen(function* () {
      getArticleModelMock.mockReturnValue(Effect.succeedNone);
      const missing = yield* readOgCopy("en", ["articles", CATEGORY, ARTICLE]);
      const deeper = yield* readOgCopy("en", [
        "articles",
        CATEGORY,
        ARTICLE,
        "extra",
      ]);
      const badCategory = yield* readOgCopy("en", [
        "articles",
        "BAD CATEGORY!",
        ARTICLE,
      ]);
      const badArticle = yield* readOgCopy("en", [
        "articles",
        CATEGORY,
        "BAD ARTICLE!",
      ]);
      const badIndexCategory = yield* readOgCopy("en", [
        "articles",
        "BAD CATEGORY!",
      ]);

      for (const copy of [
        missing,
        deeper,
        badCategory,
        badArticle,
        badIndexCategory,
      ]) {
        expect(Option.isNone(copy)).toBe(true);
      }
    })
  );
});

describe("og copy of materials", () => {
  it.effect("names one published lesson with its search title", () =>
    Effect.gen(function* () {
      const copy = yield* readOgCopy("en", [
        SUBJECT,
        "math",
        "calculus",
        "integral",
      ]);

      expect(Option.getOrThrow(copy)).toEqual({
        description: "Integral",
        title: "Integral",
      });
      expect(getMaterialModelMock).toHaveBeenCalledWith(
        "en",
        `${SUBJECT}/math/calculus/integral`
      );
    })
  );

  it.effect("answers none for an unpublished lesson", () =>
    Effect.gen(function* () {
      getMaterialModelMock.mockReturnValue(Effect.succeedNone);

      const copy = yield* readOgCopy("en", [
        SUBJECT,
        "math",
        "calculus",
        "integral",
      ]);

      expect(Option.isNone(copy)).toBe(true);
    })
  );

  it.effect(
    "answers the default copy for a material path without a lesson",
    () =>
      Effect.gen(function* () {
        const copy = yield* readOgCopy("en", [SUBJECT, "math"]);

        expect(Option.getOrThrow(copy)).toEqual({
          description: "Default",
          title: "Default",
        });
        expect(getMaterialModelMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers none for a material route that the release does not list",
    () =>
      Effect.gen(function* () {
        queryContentStoreMock.mockReturnValue(Effect.succeed(null));

        const copy = yield* readOgCopy("en", [SUBJECT, "math"]);

        expect(Option.isNone(copy)).toBe(true);
        expect(getCachedMetadataFromSlugMock).not.toHaveBeenCalled();
      })
  );
});

describe("og copy of other routes", () => {
  it.effect("answers the default copy of a route that the release lists", () =>
    Effect.gen(function* () {
      getCachedMetadataFromSlugMock.mockReturnValue(
        Effect.succeed({
          description: "Quran",
          title: "Al-Quran",
        })
      );

      const copy = yield* readOgCopy("id", ["quran", "1"]);

      expect(Option.getOrThrow(copy)).toEqual({
        description: "Quran",
        title: "Al-Quran",
      });
      expect(queryContentStoreMock).toHaveBeenCalledWith(expect.anything(), {
        input: { appLocale: "id", kind: "route", publicPath: "quran/1" },
      });
      expect(getCachedMetadataFromSlugMock).toHaveBeenCalledWith("id", [
        "quran",
        "1",
      ]);
    })
  );

  it.effect(
    "answers none for a content route that the release does not list",
    () =>
      Effect.gen(function* () {
        queryContentStoreMock.mockReturnValue(Effect.succeed(null));

        const copy = yield* readOgCopy("id", ["quran", "1000"]);

        expect(Option.isNone(copy)).toBe(true);
        expect(getCachedMetadataFromSlugMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers the default copy of a route outside the content namespaces without reading the release",
    () =>
      Effect.gen(function* () {
        const copy = yield* readOgCopy("en", ["about"]);

        expect(Option.getOrThrow(copy)).toEqual({
          description: "Default",
          title: "Default",
        });
        expect(queryContentStoreMock).not.toHaveBeenCalled();
      })
  );
});
