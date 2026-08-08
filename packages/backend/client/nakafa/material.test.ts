// @vitest-environment node

import { readPublicContentEvidence } from "@repo/backend/client/content/public";
import { readPublishedMaterialMarkdown } from "@repo/backend/client/nakafa/material";
import { fetchNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
const readMock = vi.hoisted(() => vi.fn());
const projection = makeMaterialProjection("en", 1);
const activeReleaseId = "release-example";
const target = {
  siteUrl: "https://example.convex.site",
  token: "runtime-token",
};

vi.mock("server-only", () => ({}));
vi.mock("@repo/backend/client/nakafa/query", () => ({
  fetchNakafaRuntimeQuery: queryMock,
}));
vi.mock("@repo/backend/client/content/public", () => ({
  readPublicContentEvidence: readMock,
}));

beforeEach(() => {
  queryMock.mockReset();
  readMock.mockReset();
});

describe("Nakafa material reader", () => {
  it("keeps unmanaged and missing managed material distinct", async () => {
    queryMock
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: null,
          managed: false,
          route: null,
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId,
          managed: true,
          route: null,
        })
      );

    const invalid = await Effect.runPromise(
      readPublishedMaterialMarkdown(
        "https://example.convex.cloud",
        () => target,
        "not-content"
      )
    );
    const unmanaged = await Effect.runPromise(
      readPublishedMaterialMarkdown(
        "https://example.convex.cloud",
        () => target,
        projection.graph.assetId
      )
    );
    const missing = await Effect.runPromise(
      readPublishedMaterialMarkdown(
        "https://example.convex.cloud",
        () => target,
        projection.graph.assetId
      )
    );

    expect(invalid).toEqual({
      activeReleaseId: undefined,
      managed: false,
      markdown: Option.none(),
    });
    expect(unmanaged).toEqual({
      activeReleaseId: null,
      managed: false,
      markdown: Option.none(),
    });
    expect(missing).toEqual({
      activeReleaseId,
      managed: true,
      markdown: Option.none(),
    });
    expect(fetchNakafaRuntimeQuery).toHaveBeenCalledTimes(2);
    expect(readPublicContentEvidence).not.toHaveBeenCalled();
  });

  it("reads verified raw MDX through the signed runtime", async () => {
    queryMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        managed: true,
        route: {
          locale: projection.locale,
          publicPath: projection.publicPath,
        },
      })
    );
    readMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        artifact: {
          payload: {
            rawMdx:
              'export const metadata = { title: "Ignored" }\n\n## Actual lesson',
          },
        },
        delivery: "public",
        projection,
      })
    );

    const result = await Effect.runPromise(
      readPublishedMaterialMarkdown(
        "https://example.convex.cloud",
        () => target,
        projection.graph.assetId
      )
    );

    expect(fetchNakafaRuntimeQuery).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      "lookupMaterial",
      expect.anything(),
      {
        input: {
          contentId: projection.graph.assetId,
          kind: "content",
        },
      }
    );
    expect(readPublicContentEvidence).toHaveBeenCalledWith(target, {
      locale: projection.locale,
      publicPath: projection.publicPath,
    });
    if (Option.isNone(result.markdown)) {
      expect.fail("Expected verified material markdown.");
    }
    expect(result.markdown.value).toMatchObject({
      content_id: projection.graph.assetId,
      description: "",
      text: `# ${projection.metadata.title}\n\n## Actual lesson`,
      title: projection.metadata.title,
    });
  });

  it.each([
    [
      "configuration",
      () => {
        throw new Error("missing token");
      },
      Effect.succeed({ activeReleaseId, projection }),
    ],
    ["runtime", () => target, Effect.fail(new Error("runtime unavailable"))],
    [
      "family",
      () => target,
      Effect.succeed({
        activeReleaseId,
        artifact: { payload: { rawMdx: "## Body" } },
        delivery: "public",
        projection: { ...projection, kind: "article" },
      }),
    ],
    [
      "identity",
      () => target,
      Effect.succeed({
        activeReleaseId,
        artifact: { payload: { rawMdx: "## Body" } },
        delivery: "public",
        projection: {
          ...projection,
          graph: { ...projection.graph, assetId: "invalid" },
        },
      }),
    ],
    [
      "markdown",
      () => target,
      Effect.succeed({
        activeReleaseId,
        artifact: { payload: { rawMdx: "<" } },
        delivery: "public",
        projection,
      }),
    ],
  ])(
    "maps %s failures into the agent read error",
    async (_kind, reader, read) => {
      queryMock.mockReturnValue(
        Effect.succeed({
          activeReleaseId,
          managed: true,
          route: {
            locale: projection.locale,
            publicPath: projection.publicPath,
          },
        })
      );
      readMock.mockReturnValue(read);

      await expect(
        Effect.runPromise(
          readPublishedMaterialMarkdown(
            "https://example.convex.cloud",
            reader,
            projection.graph.assetId
          ).pipe(Effect.flip)
        )
      ).resolves.toMatchObject({
        _tag: "NakafaAgentDataReadError",
        message: "Unable to read signed Nakafa material content.",
      });
    }
  );

  it("rejects a signed read from another active release", async () => {
    queryMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId,
        managed: true,
        route: {
          locale: projection.locale,
          publicPath: projection.publicPath,
        },
      })
    );
    readMock.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-rebound",
        artifact: { payload: { rawMdx: "## Body" } },
        delivery: "public",
        projection,
      })
    );

    await expect(
      Effect.runPromise(
        readPublishedMaterialMarkdown(
          "https://example.convex.cloud",
          () => target,
          projection.graph.assetId
        ).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "NakafaAgentDataReadError",
      cause: expect.stringContaining("changed before its signed read"),
    });
  });
});
