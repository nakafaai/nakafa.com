import { internal } from "@repo/backend/convex/_generated/api";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import {
  GRAPH_IDENTITY_TARGETS,
  getDataIntegrity,
} from "@repo/backend/scripts/sync-content/convex/inspection";
import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const callConvexQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/scripts/sync-content/convex/client", () => ({
  callConvexQuery: callConvexQueryMock,
}));

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};

const emptyPage = {
  continueCursor: "",
  isDone: true,
  page: [],
};

afterEach(() => {
  callConvexQueryMock.mockReset();
});

describe("sync-content inspection", () => {
  it("includes graph-backed audio tables in the verification target list", () => {
    expect(GRAPH_IDENTITY_TARGETS).toEqual(
      expect.arrayContaining([
        "audioContentSources",
        "audioGenerationQueue",
        "contentAudios",
      ])
    );
  });

  it("reports articles without references", async () => {
    const articlePath = getFunctionName(
      internal.contentSync.queries.integrity.listIntegrityArticlesPage
    );
    const referencePath = getFunctionName(
      internal.contentSync.queries.integrity.listIntegrityArticleReferencesPage
    );

    callConvexQueryMock.mockImplementation(
      (_config: ConvexConfig, query: FunctionReference<"query">) => {
        const path = getFunctionName(query);

        if (path === articlePath) {
          return Effect.succeed({
            ...emptyPage,
            page: [
              {
                id: "article-with-reference",
                locale: "id",
                sourcePath: "articles/with-reference",
              },
              {
                id: "article-without-reference",
                locale: "id",
                sourcePath: "articles/without-reference",
              },
            ],
          });
        }

        if (path === referencePath) {
          return Effect.succeed({
            ...emptyPage,
            page: [{ articleId: "article-with-reference" }],
          });
        }

        return Effect.succeed(emptyPage);
      }
    );

    const integrity = await Effect.runPromise(getDataIntegrity(config));

    expect(integrity.articlesWithoutReferences).toEqual([
      "articles/without-reference (id)",
    ]);
  });
});
