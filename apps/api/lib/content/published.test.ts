import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { TEST_PAGE_PROJECTION } from "@repo/backend/test/content-page";
import { TEST_ARTICLE_PROJECTION } from "@repo/backend/test/content-runtime";
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
            date: projection.metadata.date,
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

  it.live(
    "accepts an article projection through the same current Interface",
    () =>
      Effect.gen(function* () {
        const articleInput = {
          activeReleaseId: input.activeReleaseId,
          appLocale: TEST_ARTICLE_PROJECTION.appLocale,
          family: "article" as const,
          publicPath: TEST_ARTICLE_PROJECTION.publicPath,
        };
        readPublicContentBatchMock.mockReturnValue(
          Effect.succeed([
            {
              activeReleaseId: input.activeReleaseId,
              artifact: { payload: { rawMdx: "## Article" } },
              delivery: "public",
              projection: TEST_ARTICLE_PROJECTION,
            },
          ])
        );

        expect(yield* readPublishedApiItems([articleInput])).toMatchObject([
          {
            raw: "## Article",
            slug: TEST_ARTICLE_PROJECTION.contentKey,
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
        date: baseProjection.metadata.date,
        title: baseProjection.metadata.title,
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
          cause: "Signed content does not belong to the article or material API.",
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
