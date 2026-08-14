import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type {
  CurrentTryoutQuestionSelector,
  HistoryTryoutQuestionSelector,
} from "@/components/tryout/content/model";
import {
  makeCurrentTryoutRuntimeRequest,
  makeHistoryTryoutRuntimeRequest,
} from "@/components/tryout/content/request";

const digest = `sha256:${"a".repeat(64)}`;
const contentKey =
  "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question";
const currentQuestion: CurrentTryoutQuestionSelector = {
  artifactHash: digest,
  contentHash: "current-content-hash",
  contentKey,
  delivery: "authenticated",
  locale: "en",
  questionOrder: 1,
  snapshotId: digest,
  snapshotReleaseId: "current-release",
  sourcePath: `packages/corpus/${contentKey.slice(0, -9)}`,
  sourceRevision: "current-source",
};
const historyQuestion: HistoryTryoutQuestionSelector = {
  appLocale: "id",
  artifactHash: digest,
  artifactLocale: "en",
  contentHash: currentQuestion.contentHash,
  contentKey,
  delivery: "authenticated",
  questionOrder: currentQuestion.questionOrder,
  snapshotId: digest,
  snapshotReleaseId: "history-release",
  sourcePath: currentQuestion.sourcePath,
  sourceRevision: currentQuestion.sourceRevision,
};

describe("try-out protected runtime requests", () => {
  it("keeps the current request free of attempt and historical fields", async () => {
    const request = await Effect.runPromise(
      makeCurrentTryoutRuntimeRequest([currentQuestion])
    );

    await expect(
      Effect.runPromise(decodeProtectedContentRuntimeRequest(request))
    ).resolves.toEqual(request);
    expect(request).not.toHaveProperty("attemptId");
    expect(request.selectors[0]).not.toHaveProperty("artifactLocale");
  });

  it("binds history to one attempt and each selector artifact locale", async () => {
    const request = await Effect.runPromise(
      makeHistoryTryoutRuntimeRequest("attempt-1", [historyQuestion])
    );

    expect(request).toMatchObject({
      appLocale: "id",
      attemptId: "attempt-1",
      selectors: [{ artifactLocale: "en" }],
      snapshotId: digest,
      snapshotReleaseId: "history-release",
    });
    expect(request).not.toHaveProperty("locale");
  });

  it("fails before transport when one batch spans snapshots", async () => {
    await expect(
      Effect.runPromise(
        makeCurrentTryoutRuntimeRequest([
          currentQuestion,
          { ...currentQuestion, snapshotReleaseId: "another-release" },
        ]).pipe(Effect.flip)
      )
    ).resolves.toBeInstanceOf(ContentRuntimeVerificationError);
  });

  it("rejects empty current and historical batches", async () => {
    await expect(
      Effect.runPromise(makeCurrentTryoutRuntimeRequest([]).pipe(Effect.flip))
    ).resolves.toBeInstanceOf(ContentRuntimeVerificationError);
    await expect(
      Effect.runPromise(
        makeHistoryTryoutRuntimeRequest("attempt-1", []).pipe(Effect.flip)
      )
    ).resolves.toBeInstanceOf(ContentRuntimeVerificationError);
  });

  it("rejects a historical batch that spans retained releases", async () => {
    await expect(
      Effect.runPromise(
        makeHistoryTryoutRuntimeRequest("attempt-1", [
          historyQuestion,
          { ...historyQuestion, snapshotReleaseId: "another-release" },
        ]).pipe(Effect.flip)
      )
    ).resolves.toBeInstanceOf(ContentRuntimeVerificationError);
  });
});
