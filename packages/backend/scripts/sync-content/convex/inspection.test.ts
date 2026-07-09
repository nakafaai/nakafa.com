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

  it("reports choices whose question owner no longer exists", async () => {
    const questionPath = getFunctionName(
      internal.contentSync.queries.integrity.listIntegrityQuestionsPage
    );
    const choicePath = getFunctionName(
      internal.contentSync.queries.integrity.listIntegrityQuestionChoicesPage
    );

    callConvexQueryMock.mockImplementation(
      (_config: ConvexConfig, query: FunctionReference<"query">) => {
        const path = getFunctionName(query);

        if (path === questionPath) {
          return Effect.succeed({
            ...emptyPage,
            page: [
              {
                id: "question-current",
                locale: "id",
                sourcePath: "tryouts/current/question.1.mdx",
              },
            ],
          });
        }

        if (path === choicePath) {
          return Effect.succeed({
            ...emptyPage,
            page: [
              { questionId: "question-current" },
              { questionId: "question-orphan" },
              { questionId: "question-orphan" },
            ],
          });
        }

        return Effect.succeed(emptyPage);
      }
    );

    const integrity = await Effect.runPromise(getDataIntegrity(config));

    expect(integrity.orphanQuestionChoiceIds).toEqual(["question-orphan"]);
  });
});
