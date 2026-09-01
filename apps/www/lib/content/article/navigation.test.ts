// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { Effect, Schema } from "effect";
import {
  getShellArticleNavigation,
  readArticleNavigation,
} from "@/lib/content/article/navigation";

const categoryReaderMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const previewConfigMock = vi.hoisted(() => vi.fn(() => false));
const manifestHash = `sha256:${"a".repeat(64)}`;
const releaseId = "release-article";

vi.mock("@/lib/content/article/catalog", () => ({
  readPublishedCategories: categoryReaderMock,
}));
vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));
vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: previewConfigMock,
}));

/** Builds one release-bound signed category page. */
function categoryPage({
  category,
  done,
  route = category,
  stale = false,
  title,
}: {
  readonly category: string;
  readonly done: boolean;
  readonly route?: string;
  readonly stale?: boolean;
  readonly title: string;
}) {
  return {
    activeManifestHash: manifestHash,
    activeReleaseId: releaseId,
    categories: [
      {
        category: ArticleCategorySchema.make(category),
        rendererDomain: Schema.decodeSync(RendererDomainSchema)("politics"),
        route: ArticleRouteSlugSchema.make(route),
        title: ArticleCategoryTitleSchema.make(title),
      },
    ],
    done,
    nextCursor: done ? null : "next",
    sourceRevision: null,
    stale,
  };
}

describe("article navigation", () => {
  beforeEach(() => {
    categoryReaderMock.mockReset();
    cacheMock.mockReset();
    previewConfigMock.mockReset();
    previewConfigMock.mockReturnValue(false);
  });

  it.effect("builds navigation from every signed category page", () =>
    Effect.gen(function* () {
      categoryReaderMock
        .mockReturnValueOnce(
          Effect.succeed(
            categoryPage({
              category: "politics",
              done: false,
              title: "Politics",
            })
          )
        )
        .mockReturnValueOnce(
          Effect.succeed(
            categoryPage({
              category: "science",
              done: true,
              title: "Science",
            })
          )
        );

      const navigation = yield* Effect.tryPromise(() =>
        getShellArticleNavigation("en")
      );

      expect(navigation).toEqual([
        {
          category: "politics",
          href: "/articles/politics",
          title: "Politics",
        },
        {
          category: "science",
          href: "/articles/science",
          title: "Science",
        },
      ]);
      expect(categoryReaderMock).toHaveBeenNthCalledWith(2, {
        cursor: "next",
        expectedManifestHash: manifestHash,
        expectedReleaseId: releaseId,
        locale: "en",
      });
      expect(cacheMock).toHaveBeenCalledWith("article");
    })
  );

  it.effect.each([
    { locale: "en", route: "politics", title: "Politics" },
    { locale: "id", route: "politics", title: "Politik" },
    { locale: "de", route: "politik", title: "Politik" },
  ] as const)(
    "preserves the signed $locale category route",
    ({ locale, route, title }) =>
      Effect.gen(function* () {
        categoryReaderMock.mockReturnValueOnce(
          Effect.succeed(
            categoryPage({ category: "politics", done: true, route, title })
          )
        );

        const navigation = yield* Effect.tryPromise(() =>
          getShellArticleNavigation(locale)
        );

        expect(navigation).toEqual([
          {
            category: "politics",
            href: `/articles/${route}`,
            title,
          },
        ]);
      })
  );

  it.effect("rejects a stale category release without local fallback", () =>
    Effect.gen(function* () {
      categoryReaderMock.mockReturnValueOnce(
        Effect.succeed(
          categoryPage({
            category: "politics",
            done: true,
            stale: true,
            title: "Politics",
          })
        )
      );

      const error = yield* readArticleNavigation("en").pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect(
    "keeps the local Aksara preview shell independent from publication",
    () =>
      Effect.gen(function* () {
        previewConfigMock.mockReturnValue(true);

        const navigation = yield* Effect.tryPromise(() =>
          getShellArticleNavigation("de")
        );

        expect(navigation).toEqual([]);
        expect(categoryReaderMock).not.toHaveBeenCalled();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );
});
