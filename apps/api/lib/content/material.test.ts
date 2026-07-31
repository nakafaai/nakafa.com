import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiPublishedMaterialReadError,
  readPublishedMaterialApiItem,
  readPublishedMaterialGraphRoute,
} from "@/lib/content/material";

const readContentMock = vi.hoisted(() => vi.fn());
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
  locale: projection.locale,
  publicPath: projection.publicPath,
};

vi.mock("@repo/backend/client/content/read", () => ({
  readPublicContent: readContentMock,
}));

describe("published material API content", () => {
  beforeEach(() => {
    readContentMock.mockReset();
  });

  it("maps a signed material into partner item and graph contracts", async () => {
    readContentMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: input.activeReleaseId,
        artifact: { payload: { rawMdx: "## Signed body" } },
        projection,
      })
    );

    await expect(
      Effect.runPromise(readPublishedMaterialApiItem(input))
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
    await expect(
      Effect.runPromise(
        readPublishedMaterialGraphRoute({ ...input, syncedAt: 42 })
      )
    ).resolves.toEqual({
      ...projection.graph,
      authors: projection.metadata.authors,
      content_id: projection.graph.assetId,
      date: Date.parse(`${projection.metadata.date}T00:00:00.000Z`),
      description: projection.metadata.description,
      kind: "curriculum-lesson",
      locale: "en",
      markdown: true,
      parentRoute: projection.parentPath,
      route: projection.publicPath,
      section: "material",
      sourcePath: projection.contentKey,
      syncedAt: 42,
      title: projection.metadata.title,
    });
    expect(readContentMock).toHaveBeenCalledWith(
      {
        siteUrl: "https://test.convex.site",
        token: "test-runtime-token",
      },
      { locale: "en", publicPath: projection.publicPath }
    );
  });

  it("omits absent optional metadata from partner items", async () => {
    readContentMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: input.activeReleaseId,
        artifact: { payload: { rawMdx: "## Signed body" } },
        projection: baseProjection,
      })
    );

    await expect(
      Effect.runPromise(readPublishedMaterialApiItem(input))
    ).resolves.toMatchObject({
      metadata: {
        authors: baseProjection.metadata.authors,
        date: baseProjection.metadata.date,
        title: baseProjection.metadata.title,
      },
    });
  });

  it("maps signed-read and active-identity failures to one typed error", async () => {
    const failure = new Error("signature mismatch");
    readContentMock.mockReturnValueOnce(Effect.fail(failure));

    await expect(
      Effect.runPromise(readPublishedMaterialApiItem(input).pipe(Effect.flip))
    ).resolves.toEqual(
      new ApiPublishedMaterialReadError({
        cause: failure,
        message: "Unable to read signed material content for the public API.",
      })
    );

    readContentMock
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-next",
          artifact: { payload: { rawMdx: "" } },
          projection,
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: input.activeReleaseId,
          artifact: { payload: { rawMdx: "" } },
          projection: { kind: "article" },
        })
      );

    for (const expectedCause of [
      "Signed material content changed release or family.",
      "Signed material content changed release or family.",
    ]) {
      await expect(
        Effect.runPromise(readPublishedMaterialApiItem(input).pipe(Effect.flip))
      ).resolves.toEqual(
        new ApiPublishedMaterialReadError({
          cause: expectedCause,
          message: "Unable to read signed material content for the public API.",
        })
      );
    }
  });
});
