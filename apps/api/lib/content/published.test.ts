import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { TEST_PAGE_PROJECTION } from "@repo/backend/test/content-page";
import { testLocalizedArticleProjection } from "@repo/backend/test/content-runtime";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";
import {
  ApiPublishedContentReadError,
  readPublishedApiItems,
} from "@/lib/content/published";

const readPublicContentBatchMock = vi.hoisted(() => vi.fn());
const baseProjection = makeMaterialProjection("en", 1);
const projection = {
  ...baseProjection,
  metadata: {
    ...baseProjection.metadata,
    dateModified: "2026-08-22",
    description: "Technical description",
    subject: "Technical subject",
  },
};
const input = {
  activeReleaseId: "release-test",
  appLocale: projection.appLocale,
  family: "material" as const,
  publicPath: projection.publicPath,
};

vi.mock("@repo/backend/client/content/public", () => ({
  readPublicContentEvidenceBatch: readPublicContentBatchMock,
}));

describe("published API content", () => {
  beforeEach(() => {
    readPublicContentBatchMock.mockReset();
  });

  it.live("maps a signed material into the established partner item", () =>
    Effect.gen(function* () {
      readPublicContentBatchMock.mockReturnValue(
        Effect.succeed([
          {
            activeReleaseId: input.activeReleaseId,
            artifact: { payload: { rawMdx: "## Signed body" } },
            delivery: "public",
            projection,
          },
        ])
      );

      expect(yield* readPublishedApiItems([input])).toEqual([
        {
          ...projection.graph,
          locale: "en",
          metadata: {
            authors: projection.metadata.authors,
            date: projection.metadata.datePublished,
            dateModified: projection.metadata.dateModified,
            datePublished: projection.metadata.datePublished,
            description: projection.metadata.description,
            subject: projection.metadata.subject,
            title: projection.metadata.title,
          },
          raw: "## Signed body",
          slug: projection.contentKey,
          sourcePath: projection.contentKey,
          url: `https://nakafa.com/en/${projection.publicPath}`,
        },
      ]);
      expect(readPublicContentBatchMock).toHaveBeenCalledWith(
        {
          siteUrl: "https://test.convex.site",
          token: "test-runtime-token",
        },
        [{ appLocale: "en", publicPath: projection.publicPath }]
      );
    })
  );

  it.live.each(["en", "id", "de"] as const)(
    "accepts current article and material projections for %s",
    (appLocale) =>
      Effect.gen(function* () {
        const article = testLocalizedArticleProjection(0, appLocale);
        const material = makeMaterialProjection(appLocale, 1);
        const inputs = [
          {
            activeReleaseId: input.activeReleaseId,
            appLocale: article.appLocale,
            family: "article" as const,
            publicPath: article.publicPath,
          },
          {
            activeReleaseId: input.activeReleaseId,
            appLocale: material.appLocale,
            family: "material" as const,
            publicPath: material.publicPath,
          },
        ];
        readPublicContentBatchMock.mockReturnValue(
          Effect.succeed(
            [article, material].map((selected) => ({
              activeReleaseId: input.activeReleaseId,
              artifact: { payload: { rawMdx: "## Signed content" } },
              delivery: "public",
              projection: selected,
            }))
          )
        );

        expect(yield* readPublishedApiItems(inputs)).toMatchObject([
          {
            locale: appLocale,
            raw: "## Signed content",
            slug: article.contentKey,
            url: `https://nakafa.com/${appLocale}/${article.publicPath}`,
          },
          {
            locale: appLocale,
            raw: "## Signed content",
            slug: material.contentKey,
            url: `https://nakafa.com/${appLocale}/${material.publicPath}`,
          },
        ]);
      })
  );

  it.live("omits absent optional metadata", () =>
    Effect.gen(function* () {
      readPublicContentBatchMock.mockReturnValue(
        Effect.succeed([
          {
            activeReleaseId: input.activeReleaseId,
            artifact: { payload: { rawMdx: "## Signed body" } },
            delivery: "public",
            projection: baseProjection,
          },
        ])
      );

      const [item] = yield* readPublishedApiItems([input]);

      expect(item?.metadata).toEqual({
        authors: baseProjection.metadata.authors,
        date: baseProjection.metadata.datePublished,
        datePublished: baseProjection.metadata.datePublished,
        title: baseProjection.metadata.title,
      });
    })
  );

  it.live("normalizes an authenticated legacy projection once", () =>
    Effect.gen(function* () {
      const legacyProjection = {
        ...baseProjection,
        metadata: {
          authors: baseProjection.metadata.authors,
          date: "2026-07-24",
          title: baseProjection.metadata.title,
        },
      };
      readPublicContentBatchMock.mockReturnValue(
        Effect.succeed([
          {
            activeReleaseId: input.activeReleaseId,
            artifact: { payload: { rawMdx: "## Signed body" } },
            delivery: "public",
            projection: legacyProjection,
          },
        ])
      );

      const [item] = yield* readPublishedApiItems([input]);

      expect(item?.metadata).toEqual({
        authors: legacyProjection.metadata.authors,
        date: legacyProjection.metadata.date,
        datePublished: legacyProjection.metadata.date,
        title: legacyProjection.metadata.title,
      });
    })
  );

  it.live(
    "maps signed-read and current-identity failures to one typed error",
    () =>
      Effect.gen(function* () {
        const failure = new Error("signature mismatch");
        readPublicContentBatchMock.mockReturnValueOnce(Effect.fail(failure));

        expect(yield* readPublishedApiItems([input]).pipe(Effect.flip)).toEqual(
          new ApiPublishedContentReadError({
            cause: failure,
            message: "Unable to read signed public content for the public API.",
          })
        );

        readPublicContentBatchMock.mockReturnValueOnce(
          Effect.succeed([
            {
              activeReleaseId: "release-next",
              artifact: { payload: { rawMdx: "" } },
              delivery: "public",
              projection,
            },
          ])
        );

        expect(yield* readPublishedApiItems([input]).pipe(Effect.flip)).toEqual(
          new ApiPublishedContentReadError({
            cause:
              "Signed content changed its release, family, or public identity.",
            message: "Unable to read signed public content for the public API.",
          })
        );
      })
  );

  it.live("rejects a signed page from the article and material API", () =>
    Effect.gen(function* () {
      readPublicContentBatchMock.mockReturnValue(
        Effect.succeed([
          {
            activeReleaseId: input.activeReleaseId,
            artifact: { payload: { rawMdx: "## Signed page" } },
            delivery: "public",
            projection: TEST_PAGE_PROJECTION,
          },
        ])
      );

      expect(yield* readPublishedApiItems([input]).pipe(Effect.flip)).toEqual(
        new ApiPublishedContentReadError({
          cause:
            "Signed content does not belong to the article or material API.",
          message: "Unable to read signed public content for the public API.",
        })
      );
    })
  );

  it.live("rejects a response that loses its ordered batch item", () =>
    Effect.gen(function* () {
      readPublicContentBatchMock.mockReturnValue(Effect.succeed([]));

      expect(yield* readPublishedApiItems([input]).pipe(Effect.flip)).toEqual(
        new ApiPublishedContentReadError({
          cause: "Signed content batch lost its ordered item.",
          message: "Unable to read signed public content for the public API.",
        })
      );
    })
  );
});
