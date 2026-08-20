import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { TEST_PAGE_PROJECTION } from "@repo/backend/test/content-page";
import { TEST_ARTICLE_PROJECTION } from "@repo/backend/test/content-runtime";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("maps a signed material into the established partner item", async () => {
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

    await expect(
      Effect.runPromise(readPublishedApiItems([input]))
    ).resolves.toEqual([
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
  });

  it("accepts an article projection through the same current Interface", async () => {
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

    await expect(
      Effect.runPromise(readPublishedApiItems([articleInput]))
    ).resolves.toMatchObject([
      {
        raw: "## Article",
        slug: TEST_ARTICLE_PROJECTION.contentKey,
      },
    ]);
  });

  it("omits absent optional metadata", async () => {
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

    const [item] = await Effect.runPromise(readPublishedApiItems([input]));

    expect(item?.metadata).toEqual({
      authors: baseProjection.metadata.authors,
      date: baseProjection.metadata.date,
      title: baseProjection.metadata.title,
    });
  });

  it("maps signed-read and current-identity failures to one typed error", async () => {
    const failure = new Error("signature mismatch");
    readPublicContentBatchMock.mockReturnValueOnce(Effect.fail(failure));

    await expect(
      Effect.runPromise(readPublishedApiItems([input]).pipe(Effect.flip))
    ).resolves.toEqual(
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

    await expect(
      Effect.runPromise(readPublishedApiItems([input]).pipe(Effect.flip))
    ).resolves.toEqual(
      new ApiPublishedContentReadError({
        cause:
          "Signed content changed its release, family, or public identity.",
        message: "Unable to read signed public content for the public API.",
      })
    );
  });

  it("rejects a signed page from the article and material API", async () => {
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

    await expect(
      Effect.runPromise(readPublishedApiItems([input]).pipe(Effect.flip))
    ).resolves.toEqual(
      new ApiPublishedContentReadError({
        cause: "Signed content does not belong to the article or material API.",
        message: "Unable to read signed public content for the public API.",
      })
    );
  });

  it("rejects a response that loses its ordered batch item", async () => {
    readPublicContentBatchMock.mockReturnValue(Effect.succeed([]));

    await expect(
      Effect.runPromise(readPublishedApiItems([input]).pipe(Effect.flip))
    ).resolves.toEqual(
      new ApiPublishedContentReadError({
        cause: "Signed content batch lost its ordered item.",
        message: "Unable to read signed public content for the public API.",
      })
    );
  });
});
