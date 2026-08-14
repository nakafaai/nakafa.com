import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiPublishedContentReadError,
  readPublishedApiItem,
} from "@/lib/content/published";

const readPublicContentMock = vi.hoisted(() => vi.fn());
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
  readPublicContentEvidence: readPublicContentMock,
}));

describe("published API content", () => {
  beforeEach(() => {
    readPublicContentMock.mockReset();
  });

  it("maps a signed material into the established partner item", async () => {
    readPublicContentMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: input.activeReleaseId,
        artifact: { payload: { rawMdx: "## Signed body" } },
        delivery: "public",
        projection,
      })
    );

    await expect(
      Effect.runPromise(readPublishedApiItem(input))
    ).resolves.toEqual({
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
    });
    expect(readPublicContentMock).toHaveBeenCalledWith(
      {
        siteUrl: "https://test.convex.site",
        token: "test-runtime-token",
      },
      { appLocale: "en", publicPath: projection.publicPath }
    );
  });

  it("accepts an article projection through the same current Interface", async () => {
    const articleProjection = { ...projection, kind: "article" };
    readPublicContentMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: input.activeReleaseId,
        artifact: { payload: { rawMdx: "## Article" } },
        delivery: "public",
        projection: articleProjection,
      })
    );

    await expect(
      Effect.runPromise(readPublishedApiItem({ ...input, family: "article" }))
    ).resolves.toMatchObject({
      raw: "## Article",
      slug: projection.contentKey,
    });
  });

  it("omits absent optional metadata", async () => {
    readPublicContentMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: input.activeReleaseId,
        artifact: { payload: { rawMdx: "## Signed body" } },
        delivery: "public",
        projection: baseProjection,
      })
    );

    const item = await Effect.runPromise(readPublishedApiItem(input));

    expect(item.metadata).toEqual({
      authors: baseProjection.metadata.authors,
      date: baseProjection.metadata.date,
      title: baseProjection.metadata.title,
    });
  });

  it("maps signed-read and current-identity failures to one typed error", async () => {
    const failure = new Error("signature mismatch");
    readPublicContentMock.mockReturnValueOnce(Effect.fail(failure));

    await expect(
      Effect.runPromise(readPublishedApiItem(input).pipe(Effect.flip))
    ).resolves.toEqual(
      new ApiPublishedContentReadError({
        cause: failure,
        message: "Unable to read signed public content for the public API.",
      })
    );

    readPublicContentMock.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId: "release-next",
        artifact: { payload: { rawMdx: "" } },
        delivery: "public",
        projection,
      })
    );

    await expect(
      Effect.runPromise(readPublishedApiItem(input).pipe(Effect.flip))
    ).resolves.toEqual(
      new ApiPublishedContentReadError({
        cause:
          "Signed content changed its release, family, or public identity.",
        message: "Unable to read signed public content for the public API.",
      })
    );
  });
});
