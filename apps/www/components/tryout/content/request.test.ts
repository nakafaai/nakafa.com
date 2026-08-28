import { describe, expect, it } from "@effect/vitest";
import { StoredProtectedRuntimeRequestSchema } from "@nakafa/aksara-contracts/history/decode";
import { decodeProtectedContentRuntimeRequest as decodePredecessorContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/predecessor/spec";
import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { Effect, Schema } from "effect";
import type {
  CurrentTryoutQuestionSelector,
  HistoryTryoutQuestionSelector,
  PredecessorTryoutQuestionSelector,
} from "@/components/tryout/content/model";
import {
  makeCurrentTryoutRuntimeRequest,
  makeHistoryTryoutRuntimeRequest,
  makePredecessorTryoutRuntimeRequest,
  requireLiveTryoutQuestion,
} from "@/components/tryout/content/request";

const digest = `sha256:${"a".repeat(64)}`;
const contentKey =
  "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question";
const currentQuestion: CurrentTryoutQuestionSelector = {
  appLocale: "en",
  artifactHash: digest,
  bundleHash: digest,
  contentHash: "current-content-hash",
  contentKey,
  delivery: "authenticated",
  questionOrder: 1,
  snapshotId: digest,
  snapshotReleaseId: "current-release",
  sourcePath: `packages/corpus/${contentKey.slice(0, -9)}`,
  sourceRevision: "current-source",
};
const predecessorQuestion: PredecessorTryoutQuestionSelector = {
  appLocale: currentQuestion.appLocale,
  artifactHash: currentQuestion.artifactHash,
  contentHash: currentQuestion.contentHash,
  contentKey: currentQuestion.contentKey,
  delivery: currentQuestion.delivery,
  questionOrder: currentQuestion.questionOrder,
  snapshotId: currentQuestion.snapshotId,
  snapshotReleaseId: currentQuestion.snapshotReleaseId,
  sourcePath: currentQuestion.sourcePath,
  sourceRevision: currentQuestion.sourceRevision,
};
const historyQuestion: HistoryTryoutQuestionSelector = {
  ...predecessorQuestion,
  appLocale: "id",
  artifactLocale: "en",
  snapshotReleaseId: "history-release",
};

describe("try-out protected runtime requests", () => {
  it.effect("rejects an empty protected content batch", () =>
    Effect.gen(function* () {
      expect(
        yield* makeCurrentTryoutRuntimeRequest([]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.effect("builds the predecessor request without permanent fields", () =>
    Effect.gen(function* () {
      const request = yield* makePredecessorTryoutRuntimeRequest([
        predecessorQuestion,
      ]);
      expect(yield* decodePredecessorContentRuntimeRequest(request)).toEqual(
        request
      );
      expect(request).not.toHaveProperty("bundleHash");
      expect(request).toMatchObject({
        appLocale: "en",
        snapshotReleaseId: "current-release",
      });
    })
  );

  it.effect(
    "keeps the current request free of attempt and historical fields",
    () =>
      Effect.gen(function* () {
        const request = yield* makeCurrentTryoutRuntimeRequest([
          currentQuestion,
        ]);

        expect(yield* decodeProtectedContentRuntimeRequest(request)).toEqual(
          request
        );
        expect(request).not.toHaveProperty("attemptId");
        expect(request.selectors[0]).not.toHaveProperty("artifactLocale");
      })
  );

  it.effect(
    "binds history to one attempt and each selector artifact locale",
    () =>
      Effect.gen(function* () {
        const request = yield* makeHistoryTryoutRuntimeRequest("attempt-1", [
          historyQuestion,
        ]);

        expect(
          yield* Schema.decodeUnknownEffect(
            StoredProtectedRuntimeRequestSchema
          )(request)
        ).toEqual(request);
        expect(request).toMatchObject({
          appLocale: "id",
          attemptId: "attempt-1",
          selectors: [{ artifactLocale: "en" }],
          snapshotId: digest,
          snapshotReleaseId: "history-release",
        });
      })
  );

  it.effect("fails before transport when one batch spans bundles", () =>
    Effect.gen(function* () {
      expect(
        yield* makeCurrentTryoutRuntimeRequest([
          currentQuestion,
          { ...currentQuestion, bundleHash: `sha256:${"b".repeat(64)}` },
        ]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.effect("fails before transport when one batch spans releases", () =>
    Effect.gen(function* () {
      expect(
        yield* makeCurrentTryoutRuntimeRequest([
          currentQuestion,
          { ...currentQuestion, snapshotReleaseId: "another-release" },
        ]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.effect("keeps the featured operation on live signed content", () =>
    Effect.gen(function* () {
      expect(yield* requireLiveTryoutQuestion(currentQuestion)).toEqual(
        currentQuestion
      );
      expect(yield* requireLiveTryoutQuestion(predecessorQuestion)).toEqual(
        predecessorQuestion
      );
      expect(
        yield* requireLiveTryoutQuestion(historyQuestion).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );
});
