import { StoredProtectedRuntimeRequestSchema } from "@nakafa/aksara-contracts/history/decode";
import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import type {
  CurrentTryoutQuestionSelector,
  HistoryTryoutQuestionSelector,
} from "@/components/tryout/content/model";
import {
  makeCurrentTryoutRuntimeRequest,
  makeHistoryTryoutRuntimeRequest,
  requireCurrentTryoutQuestion,
} from "@/components/tryout/content/request";

const digest = `sha256:${"a".repeat(64)}`;
const contentKey =
  "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question";
const currentQuestion: CurrentTryoutQuestionSelector = {
  appLocale: "en",
  artifactHash: digest,
  contentHash: "current-content-hash",
  contentKey,
  delivery: "authenticated",
  questionOrder: 1,
  snapshotId: digest,
  snapshotReleaseId: "current-release",
  sourcePath: `packages/corpus/${contentKey.slice(0, -9)}`,
  sourceRevision: "current-source",
};
const historyQuestion: HistoryTryoutQuestionSelector = {
  ...currentQuestion,
  appLocale: "id",
  artifactLocale: "en",
  snapshotReleaseId: "history-release",
};

describe("try-out protected runtime requests", () => {
  it("rejects an empty protected content batch", async () => {
    await expect(
      Effect.runPromise(makeCurrentTryoutRuntimeRequest([]).pipe(Effect.flip))
    ).resolves.toBeInstanceOf(ContentRuntimeVerificationError);
  });

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

    expect(
      Schema.decodeUnknownSync(StoredProtectedRuntimeRequestSchema)(request)
    ).toEqual(request);
    expect(request).toMatchObject({
      appLocale: "id",
      attemptId: "attempt-1",
      selectors: [{ artifactLocale: "en" }],
      snapshotId: digest,
      snapshotReleaseId: "history-release",
    });
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

  it("keeps the featured operation current-only", async () => {
    await expect(
      Effect.runPromise(requireCurrentTryoutQuestion(currentQuestion))
    ).resolves.toEqual(currentQuestion);
    await expect(
      Effect.runPromise(
        requireCurrentTryoutQuestion(historyQuestion).pipe(Effect.flip)
      )
    ).resolves.toBeInstanceOf(ContentRuntimeVerificationError);
  });
});
