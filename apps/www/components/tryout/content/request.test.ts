import { StoredProtectedRuntimeRequestSchema } from "@nakafa/aksara-contracts/history/decode";
import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";
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
  it.live("rejects an empty protected content batch", () =>
    Effect.gen(function* () {
      expect(
        yield* makeCurrentTryoutRuntimeRequest([]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.live(
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

  it.live(
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

  it.live("fails before transport when one batch spans snapshots", () =>
    Effect.gen(function* () {
      expect(
        yield* makeCurrentTryoutRuntimeRequest([
          currentQuestion,
          { ...currentQuestion, snapshotReleaseId: "another-release" },
        ]).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );

  it.live("keeps the featured operation current-only", () =>
    Effect.gen(function* () {
      expect(yield* requireCurrentTryoutQuestion(currentQuestion)).toEqual(
        currentQuestion
      );
      expect(
        yield* requireCurrentTryoutQuestion(historyQuestion).pipe(Effect.flip)
      ).toBeInstanceOf(ContentRuntimeVerificationError);
    })
  );
});
